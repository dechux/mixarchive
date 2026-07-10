import fs from "fs";
import path from "path";

import {
  Storage
} from "../lib/storage.js";

import {
  MixArchiveDatabase
} from "../lib/database.js";

const DEFAULT_EVENT_DETAILS_DIR =
  path.join(
    "data",
    "current",
    "event-details"
  );

function parseArgs(argv) {
  const options = {
    apply: false,
    limit: null
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number(
        arg.replace(
          "--limit=",
          ""
        )
      );

      if (
        Number.isFinite(value) &&
        value > 0
      ) {
        options.limit =
          Math.floor(value);
      }
    }
  }

  return options;
}

function printHeader(title) {
  console.log("");

  console.log(
    "========================================"
  );

  console.log(title);

  console.log(
    "========================================"
  );

  console.log("");
}

function readJsonFile(filePath) {
  try {
    const text =
      fs.readFileSync(
        filePath,
        "utf8"
      );

    return JSON.parse(text);
  } catch (error) {
    return {
      __readError:
        error.message
    };
  }
}

function getEventDetailFiles() {
  if (
    !fs.existsSync(
      DEFAULT_EVENT_DETAILS_DIR
    )
  ) {
    return [];
  }

  return fs
    .readdirSync(
      DEFAULT_EVENT_DETAILS_DIR,
      {
        withFileTypes: true
      }
    )
    .filter(entry =>
      entry.isFile() &&
      entry.name.endsWith(".json")
    )
    .map(entry =>
      path.join(
        DEFAULT_EVENT_DETAILS_DIR,
        entry.name
      )
    )
    .sort();
}

function eventExistsInSqlite(
  database,
  eventKey
) {
  const row =
    database.db
      .prepare(`
        SELECT
          event_key
        FROM events
        WHERE event_key = ?
        LIMIT 1
      `)
      .get(eventKey);

  return Boolean(row);
}

function getHistoryCountSqlite(
  database
) {
  const row =
    database.db
      .prepare(`
        SELECT
          COUNT(*) AS count
        FROM event_detail_history
      `)
      .get();

  return row?.count ?? 0;
}

function getHistoryCountJson() {
  const directoryPath =
    path.join(
      "data",
      "current",
      "event-detail-history"
    );

  if (
    !fs.existsSync(
      directoryPath
    )
  ) {
    return 0;
  }

  let count = 0;

  const eventDirectories =
    fs.readdirSync(
      directoryPath,
      {
        withFileTypes: true
      }
    );

  for (
    const eventDirectory of
    eventDirectories
  ) {
    if (
      !eventDirectory.isDirectory()
    ) {
      continue;
    }

    const eventDirectoryPath =
      path.join(
        directoryPath,
        eventDirectory.name
      );

    const files =
      fs.readdirSync(
        eventDirectoryPath,
        {
          withFileTypes: true
        }
      );

    count += files.filter(
      entry =>
        entry.isFile() &&
        entry.name.endsWith(".json")
    ).length;
  }

  return count;
}

function createSummary() {
  return {
    scanned: 0,
    eligible: 0,

    alreadyInJson: 0,
    alreadyInSqlite: 0,

    wouldSaveJson: 0,
    wouldSaveSqlite: 0,

    savedJson: 0,
    savedSqlite: 0,

    skippedMissingEventKey: 0,
    skippedMissingDetailHash: 0,
    skippedOrphanEvent: 0,
    skippedReadError: 0,

    failedJson: 0,
    failedSqlite: 0
  };
}

function printItem({
  eventKey,
  detailHash,
  action,
  reason = null
}) {
  console.log(
    `${action}: ${eventKey || "(no eventKey)"}`
  );

  if (detailHash) {
    console.log(
      `  detailHash: ${detailHash}`
    );
  }

  if (reason) {
    console.log(
      `  reason: ${reason}`
    );
  }

  console.log("");
}

function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  printHeader(
    "MixArchive EventDetail history backfill"
  );

  console.log(
    options.apply
      ? "Mode: APPLY"
      : "Mode: DRY RUN"
  );

  console.log("");

  if (!options.apply) {
    console.log(
      "No data will be modified."
    );

    console.log(
      "Use --apply only after reviewing this result."
    );

    console.log("");
  }

  console.log({
    limit:
      options.limit
  });

  const storage =
    new Storage();

  const database =
    new MixArchiveDatabase();

  try {
    const historyJsonBefore =
      getHistoryCountJson();

    const historySqliteBefore =
      getHistoryCountSqlite(
        database
      );

    console.log("");

    console.log(
      `EventDetail history JSON before: ${historyJsonBefore}`
    );

    console.log(
      `EventDetail history SQLite before: ${historySqliteBefore}`
    );

    console.log("");

    let files =
      getEventDetailFiles();

    if (options.limit) {
      files = files.slice(
        0,
        options.limit
      );
    }

    const summary =
      createSummary();

    for (const filePath of files) {
      summary.scanned += 1;

      const detail =
        readJsonFile(
          filePath
        );

      if (detail.__readError) {
        summary.skippedReadError += 1;

        printItem({
          eventKey:
            path.basename(
              filePath,
              ".json"
            ),

          action:
            "SKIP",

          reason:
            `read error: ${detail.__readError}`
        });

        continue;
      }

      const eventKey =
        String(
          detail.eventKey || ""
        ).trim();

      const detailHash =
        String(
          detail.detailHash || ""
        ).trim();

      if (!eventKey) {
        summary
          .skippedMissingEventKey +=
          1;

        printItem({
          eventKey: null,
          detailHash,
          action: "SKIP",
          reason:
            "missing eventKey"
        });

        continue;
      }

      if (!detailHash) {
        summary
          .skippedMissingDetailHash +=
          1;

        printItem({
          eventKey,
          action: "SKIP",
          reason:
            "missing detailHash"
        });

        continue;
      }

      if (
        !eventExistsInSqlite(
          database,
          eventKey
        )
      ) {
        summary
          .skippedOrphanEvent +=
          1;

        printItem({
          eventKey,
          detailHash,
          action: "SKIP",
          reason:
            "event does not exist in SQLite events table"
        });

        continue;
      }

      summary.eligible += 1;

      const existsInJson =
        storage.hasEventDetailHistory(
          eventKey,
          detailHash
        );

      const existsInSqlite =
        Boolean(
          database
            .getEventDetailHistoryByHash(
              eventKey,
              detailHash
            )
        );

      if (existsInJson) {
        summary.alreadyInJson += 1;
      } else {
        summary.wouldSaveJson += 1;
      }

      if (existsInSqlite) {
        summary.alreadyInSqlite += 1;
      } else {
        summary.wouldSaveSqlite += 1;
      }

      if (
        existsInJson &&
        existsInSqlite
      ) {
        printItem({
          eventKey,
          detailHash,
          action: "DUPLICATE",
          reason:
            "already exists in JSON and SQLite"
        });

        continue;
      }

      if (!options.apply) {
        const targets = [];

        if (!existsInJson) {
          targets.push("JSON");
        }

        if (!existsInSqlite) {
          targets.push("SQLite");
        }

        printItem({
          eventKey,
          detailHash,
          action: "WOULD SAVE",
          reason:
            targets.join(" + ")
        });

        continue;
      }

      if (!existsInJson) {
        try {
          const jsonResult =
            storage
              .saveEventDetailHistory(
                detail
              );

          if (jsonResult.saved) {
            summary.savedJson += 1;
          } else {
            summary.alreadyInJson += 1;
          }
        } catch (error) {
          summary.failedJson += 1;

          printItem({
            eventKey,
            detailHash,
            action:
              "JSON SAVE FAILED",

            reason:
              error.message
          });
        }
      }

      if (!existsInSqlite) {
        try {
          const sqliteResult =
            database
              .saveEventDetailHistory({
                ...detail,

                capturedAt:
                  detail.detailCapturedAt ||
                  detail.capturedAt ||
                  null
              });

          if (sqliteResult.saved) {
            summary.savedSqlite += 1;
          } else {
            summary.alreadyInSqlite += 1;
          }
        } catch (error) {
          summary.failedSqlite += 1;

          printItem({
            eventKey,
            detailHash,
            action:
              "SQLITE SAVE FAILED",

            reason:
              error.message
          });
        }
      }

      printItem({
        eventKey,
        detailHash,
        action: "PROCESSED"
      });
    }

    const historyJsonAfter =
      getHistoryCountJson();

    const historySqliteAfter =
      getHistoryCountSqlite(
        database
      );

    printHeader(
      "Backfill summary"
    );

    console.log(summary);

    console.log("");

    console.log(
      `EventDetail history JSON before:  ${historyJsonBefore}`
    );

    console.log(
      `EventDetail history JSON after:   ${historyJsonAfter}`
    );

    console.log("");

    console.log(
      `EventDetail history SQLite before: ${historySqliteBefore}`
    );

    console.log(
      `EventDetail history SQLite after:  ${historySqliteAfter}`
    );

    console.log("");

    if (!options.apply) {
      console.log(
        "Dry run completed. No data was modified."
      );

      console.log("");

      console.log(
        "Review the summary, then run with --apply when ready."
      );
    } else if (
      summary.failedJson === 0 &&
      summary.failedSqlite === 0
    ) {
      console.log(
        "Backfill completed without save errors."
      );
    } else {
      console.log(
        "Backfill completed with save errors."
      );

      console.log(
        "Run the consistency checker before continuing."
      );

      process.exitCode = 1;
    }
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error("");

  console.error(
    "EventDetail history backfill failed."
  );

  console.error("");

  console.error(error);

  process.exit(1);
}