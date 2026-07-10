import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  chromium
} from "playwright";

import {
  fetchEvents
} from "../lib/scraper.js";

import {
  createEventRecord
} from "../lib/eventService.js";

import {
  EventPageService
} from "../lib/eventPageService.js";

import {
  EventDetailService
} from "../lib/eventDetailService.js";

import {
  Storage
} from "../lib/storage.js";

import {
  MixArchiveDatabase
} from "../lib/database.js";

import {
  ArchiveUpdateService
} from "../lib/archiveUpdateService.js";

const TEMP_ROOT_DIR =
  ".tmp/update-integration-test";

function parseArgs(argv) {
  const options = {
    waitMs: 2000,
    headless: true,
    candidateLimit: 5
  };

  for (const arg of argv) {
    if (
      arg.startsWith(
        "--wait-ms="
      )
    ) {
      const value = Number(
        arg.replace(
          "--wait-ms=",
          ""
        )
      );

      if (
        Number.isFinite(value) &&
        value >= 0
      ) {
        options.waitMs =
          Math.floor(value);
      }

      continue;
    }

    if (
      arg.startsWith(
        "--candidate-limit="
      )
    ) {
      const value = Number(
        arg.replace(
          "--candidate-limit=",
          ""
        )
      );

      if (
        Number.isFinite(value) &&
        value > 0
      ) {
        options.candidateLimit =
          Math.floor(value);
      }

      continue;
    }

    if (arg === "--headed") {
      options.headless = false;
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

function printPass(message) {
  console.log(
    `PASS: ${message}`
  );
}

function createRunDirectory() {
  const runId =
    `${Date.now()}-${process.pid}`;

  const runDirectory =
    path.join(
      TEMP_ROOT_DIR,
      runId
    );

  fs.mkdirSync(
    runDirectory,
    {
      recursive: true
    }
  );

  return runDirectory;
}

function countJsonFiles(
  directoryPath
) {
  if (
    !fs.existsSync(
      directoryPath
    )
  ) {
    return 0;
  }

  return fs
    .readdirSync(
      directoryPath,
      {
        withFileTypes: true
      }
    )
    .reduce(
      (
        count,
        entry
      ) => {
        const entryPath =
          path.join(
            directoryPath,
            entry.name
          );

        if (entry.isDirectory()) {
          return (
            count +
            countJsonFiles(
              entryPath
            )
          );
        }

        if (
          entry.isFile() &&
          entry.name.endsWith(
            ".json"
          )
        ) {
          return count + 1;
        }

        return count;
      },
      0
    );
}

function getTableCount(
  database,
  tableName
) {
  const allowedTables =
    new Set([
      "events",
      "event_details",
      "event_detail_history",
      "page_cache",
      "livers",
      "liver_names",
      "snapshots",
      "ranking_entries"
    ]);

  if (
    !allowedTables.has(
      tableName
    )
  ) {
    throw new Error(
      `Unsupported table: ${tableName}`
    );
  }

  const row =
    database.db
      .prepare(`
        SELECT
          COUNT(*) AS count
        FROM ${tableName}
      `)
      .get();

  return row?.count ?? 0;
}

async function findUsableEvent({
  page,
  rawEvents,
  waitMs,
  candidateLimit
}) {
  const candidates =
    rawEvents.slice(
      0,
      candidateLimit
    );

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const rawEvent =
      candidates[index];

    console.log(
      `Checking candidate ` +
      `${index + 1}/${candidates.length}`
    );

    console.log(
      `  eventId: ${rawEvent.eventId}`
    );

    console.log(
      `  title: ${rawEvent.title}`
    );

    try {
      const startedAtMs =
        Date.now();

      const pageContent =
        await EventPageService.open({
          page,

          event:
            rawEvent,

          waitMs
        });

      const detailWithoutEventKey =
        EventDetailService.fetch({
          pageContent,
          event: rawEvent
        });

      if (
        !detailWithoutEventKey.startAt ||
        !detailWithoutEventKey.endAt
      ) {
        console.log(
          "  skipped: missing period"
        );

        console.log("");

        continue;
      }

      const eventRecord =
        createEventRecord({
          eventId:
            rawEvent.eventId,

          title:
            rawEvent.title,

          eventUrl:
            rawEvent.eventUrl,

          startAt:
            detailWithoutEventKey.startAt,

          endAt:
            detailWithoutEventKey.endAt,

          status:
            "active"
        });

      console.log(
        "  usable event found"
      );

      console.log("");

      return {
        rawEvent,
        pageContent,
        detailWithoutEventKey,
        eventRecord,
        startedAtMs
      };
    } catch (error) {
      console.log(
        `  skipped: ${error.message}`
      );

      console.log("");
    }
  }

  return null;
}

function verifyFirstPass({
  storage,
  database,
  result
}) {
  const {
    eventRecord,
    detail,
    ranking,
    durationMs,
    jsonDetailHistoryResult,
    sqliteDetailHistoryResult,
    rankingSaveResult
  } = result;

  assert.equal(
    jsonDetailHistoryResult.saved,
    true,
    "First JSON detail history save must succeed."
  );

  assert.equal(
    sqliteDetailHistoryResult.saved,
    true,
    "First SQLite detail history save must succeed."
  );

  assert.equal(
    rankingSaveResult.saved,
    true,
    "First ranking snapshot save must succeed."
  );

  assert.ok(
    Number.isInteger(durationMs),
    "durationMs must be an integer."
  );

  assert.ok(
    durationMs >= 0,
    "durationMs must be zero or greater."
  );

  assert.ok(
    storage.readEvent(
      eventRecord.eventKey
    ),
    "Event JSON was not saved."
  );

  assert.ok(
    storage.readEventDetail(
      eventRecord.eventKey
    ),
    "Event detail JSON was not saved."
  );

  assert.ok(
    storage.readPageCache(
      eventRecord.eventKey
    ),
    "Page cache JSON was not saved."
  );

  assert.ok(
    storage.readRanking(
      eventRecord.eventKey
    ),
    "Ranking JSON was not saved."
  );

  assert.ok(
    storage.readEventDetailHistory(
      eventRecord.eventKey,
      detail.detailHash
    ),
    "Event detail history JSON was not saved."
  );

  const snapshotJson =
    storage.readSnapshot(
      rankingSaveResult.snapshotId
    );

  assert.ok(
    snapshotJson,
    "Snapshot JSON was not saved."
  );

  assert.equal(
    snapshotJson.durationMs,
    durationMs,
    "Snapshot JSON durationMs does not match."
  );

  const sqliteSnapshot =
    database.db
      .prepare(`
        SELECT
          duration_ms
        FROM snapshots
        WHERE snapshot_id = ?
        LIMIT 1
      `)
      .get(
        rankingSaveResult.snapshotId
      );

  assert.ok(
    sqliteSnapshot,
    "SQLite snapshot was not saved."
  );

  assert.equal(
    sqliteSnapshot.duration_ms,
    durationMs,
    "SQLite snapshot duration_ms does not match."
  );

  assert.equal(
    getTableCount(
      database,
      "events"
    ),
    1,
    "Expected exactly one event."
  );

  assert.equal(
    getTableCount(
      database,
      "event_details"
    ),
    1,
    "Expected exactly one event detail."
  );

  assert.equal(
    getTableCount(
      database,
      "event_detail_history"
    ),
    1,
    "Expected exactly one event detail history."
  );

  assert.equal(
    getTableCount(
      database,
      "page_cache"
    ),
    1,
    "Expected exactly one page cache row."
  );

  assert.equal(
    getTableCount(
      database,
      "snapshots"
    ),
    1,
    "Expected exactly one ranking snapshot."
  );

  assert.equal(
    getTableCount(
      database,
      "ranking_entries"
    ),
    ranking.entryCount,
    "Ranking entry count does not match."
  );

  printPass(
    "First update pass saved JSON, SQLite and durationMs."
  );
}

function verifySecondPass({
  database,
  firstResult,
  secondResult
}) {
  assert.equal(
    secondResult
      .jsonDetailHistoryResult
      .saved,
    false,
    "Duplicate JSON detail history was saved."
  );

  assert.equal(
    secondResult
      .jsonDetailHistoryResult
      .reason,
    "duplicate-detail-hash",
    "Unexpected JSON detail history duplicate reason."
  );

  assert.equal(
    secondResult
      .sqliteDetailHistoryResult
      .saved,
    false,
    "Duplicate SQLite detail history was saved."
  );

  assert.equal(
    secondResult
      .sqliteDetailHistoryResult
      .reason,
    "duplicate-detail-hash",
    "Unexpected SQLite detail history duplicate reason."
  );

  assert.equal(
    secondResult
      .rankingSaveResult
      .saved,
    false,
    "Duplicate ranking snapshot was saved."
  );

  assert.equal(
    secondResult
      .rankingSaveResult
      .reason,
    "duplicate-ranking-hash",
    "Unexpected ranking duplicate reason."
  );

  assert.equal(
    firstResult.detail.detailHash,
    secondResult.detail.detailHash,
    "detailHash changed for identical page content."
  );

  assert.equal(
    firstResult.ranking.rankingHash,
    secondResult.ranking.rankingHash,
    "rankingHash changed for identical page content."
  );

  assert.equal(
    getTableCount(
      database,
      "event_detail_history"
    ),
    1,
    "Duplicate event detail history row was added."
  );

  assert.equal(
    getTableCount(
      database,
      "snapshots"
    ),
    1,
    "Duplicate ranking snapshot row was added."
  );

  assert.equal(
    getTableCount(
      database,
      "ranking_entries"
    ),
    firstResult.ranking.entryCount,
    "Duplicate ranking entries were added."
  );

  printPass(
    "Second update pass was Duplicate Safe."
  );
}

function verifyJsonCounts({
  dataDirectory,
  firstResult
}) {
  const eventHistoryDirectory =
    path.join(
      dataDirectory,
      "event-detail-history",
      firstResult.eventRecord.eventKey
    );

  assert.equal(
    countJsonFiles(
      path.join(
        dataDirectory,
        "events"
      )
    ),
    1,
    "Unexpected event JSON count."
  );

  assert.equal(
    countJsonFiles(
      path.join(
        dataDirectory,
        "event-details"
      )
    ),
    1,
    "Unexpected event detail JSON count."
  );

  assert.equal(
    countJsonFiles(
      eventHistoryDirectory
    ),
    1,
    "Duplicate event detail history JSON was added."
  );

  assert.equal(
    countJsonFiles(
      path.join(
        dataDirectory,
        "page-cache"
      )
    ),
    1,
    "Unexpected page cache JSON count."
  );

  assert.equal(
    countJsonFiles(
      path.join(
        dataDirectory,
        "rankings"
      )
    ),
    1,
    "Unexpected ranking JSON count."
  );

  assert.equal(
    countJsonFiles(
      path.join(
        dataDirectory,
        "snapshots"
      )
    ),
    1,
    "Duplicate snapshot JSON was added."
  );

  assert.equal(
    countJsonFiles(
      path.join(
        dataDirectory,
        "livers"
      )
    ),
    firstResult.uniqueLivers,
    "Liver JSON count does not match unique liver count."
  );

  printPass(
    "Temporary JSON data is consistent."
  );
}

async function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  printHeader(
    "MixArchive update integration test"
  );

  console.log(
    "This test does not modify production JSON or production SQLite."
  );

  console.log("");

  console.log({
    waitMs:
      options.waitMs,

    headless:
      options.headless,

    candidateLimit:
      options.candidateLimit
  });

  const runDirectory =
    createRunDirectory();

  const dataDirectory =
    path.join(
      runDirectory,
      "data"
    );

  const databasePath =
    path.join(
      runDirectory,
      "database",
      "mixarchive-test.db"
    );

  console.log("");

  console.log(
    `Temporary directory: ${runDirectory}`
  );

  const storage =
    new Storage({
      baseDir:
        dataDirectory,

      backupDir:
        path.join(
          runDirectory,
          "backups"
        ),

      enableBackup:
        false
    });

  const database =
    new MixArchiveDatabase(
      databasePath
    );

  const updateService =
    new ArchiveUpdateService({
      storage,
      database
    });

  let browser = null;

  let success = false;

  try {
    printHeader(
      "1. Fetch event list"
    );

    const fetchResult =
      await fetchEvents();

    const rawEvents =
      fetchResult.events || [];

    assert.ok(
      rawEvents.length > 0,
      "No active events were fetched."
    );

    console.log(
      `Fetched active events: ${rawEvents.length}`
    );

    printPass(
      "Event list fetched."
    );

    printHeader(
      "2. Find one usable event"
    );

    browser =
      await chromium.launch({
        headless:
          options.headless
      });

    const page =
      await browser.newPage();

    const source =
      await findUsableEvent({
        page,

        rawEvents,

        waitMs:
          options.waitMs,

        candidateLimit:
          options.candidateLimit
      });

    assert.ok(
      source,
      "No usable event was found."
    );

    console.log(
      `Selected eventKey: ${source.eventRecord.eventKey}`
    );

    console.log(
      `Title: ${source.eventRecord.title}`
    );

    printHeader(
      "3. First update pass"
    );

    const firstResult =
      updateService.updateEvent({
        eventRecord:
          source.eventRecord,

        pageContent:
          source.pageContent,

        detailWithoutEventKey:
          source.detailWithoutEventKey,

        scheduledAt:
          null,

        status:
          "success",

        startedAtMs:
          source.startedAtMs
      });

    assert.ok(
      firstResult.ranking.entryCount > 0,
      "Selected event has no ranking entries."
    );

    console.log(
      `Ranking entries: ${firstResult.ranking.entryCount}`
    );

    verifyFirstPass({
      storage,
      database,

      result:
        firstResult
    });

    console.log("");

    console.log(
      `detailHash: ${firstResult.detail.detailHash}`
    );

    console.log(
      `rankingHash: ${firstResult.ranking.rankingHash}`
    );

    console.log(
      `uniqueLivers: ${firstResult.uniqueLivers}`
    );

    console.log(
      `durationMs: ${firstResult.durationMs}`
    );

    printHeader(
      "4. Second update pass"
    );

    const secondStartedAtMs =
      Date.now();

    const secondResult =
      updateService.updateEvent({
        eventRecord:
          source.eventRecord,

        pageContent:
          source.pageContent,

        detailWithoutEventKey:
          source.detailWithoutEventKey,

        scheduledAt:
          null,

        status:
          "success",

        startedAtMs:
          secondStartedAtMs
      });

    verifySecondPass({
      database,
      firstResult,
      secondResult
    });

    console.log("");

    console.log(
      "JSON detail history: duplicate blocked"
    );

    console.log(
      "SQLite detail history: duplicate blocked"
    );

    console.log(
      "Ranking snapshot: duplicate blocked"
    );

    printHeader(
      "5. JSON consistency"
    );

    verifyJsonCounts({
      dataDirectory,
      firstResult
    });

    printHeader(
      "Test summary"
    );

    console.log(
      `eventKey: ${firstResult.eventRecord.eventKey}`
    );

    console.log(
      `rankingEntries: ${firstResult.ranking.entryCount}`
    );

    console.log(
      `uniqueLivers: ${firstResult.uniqueLivers}`
    );

    console.log(
      `durationMs: ${firstResult.durationMs}`
    );

    console.log("");

    console.log(
      "All update integration tests passed."
    );

    success = true;
  } finally {
    if (browser) {
      await browser.close();
    }

    database.close();

    if (success) {
      fs.rmSync(
        runDirectory,
        {
          recursive: true,
          force: true
        }
      );

      console.log("");

      console.log(
        "Temporary test data removed."
      );
    } else {
      console.log("");

      console.log(
        "Test failed. Temporary data was preserved for debugging:"
      );

      console.log(
        runDirectory
      );
    }
  }
}

main().catch((error) => {
  console.error("");

  console.error(
    "Update integration test failed."
  );

  console.error("");

  console.error(error);

  process.exit(1);
});