import fs from "fs";
import path from "path";

import { Storage } from "../lib/storage.js";
import { MixArchiveDatabase } from "../lib/database.js";

const JSON_BASE_DIR = "data/current";

function parseArgs(argv) {
  const options = {
    dryRun: true,
    apply: false
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      options.dryRun = false;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      options.apply = false;
    }
  }

  return options;
}

function getJsonFileNames(directoryName) {
  const directoryPath = path.join(
    JSON_BASE_DIR,
    directoryName
  );

  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter(fileName =>
      fileName.endsWith(".json")
    )
    .sort();
}

function readJsonFile(
  directoryName,
  fileName
) {
  const filePath = path.join(
    JSON_BASE_DIR,
    directoryName,
    fileName
  );

  try {
    const text = fs.readFileSync(
      filePath,
      "utf8"
    );

    return {
      ok: true,
      filePath,
      data: JSON.parse(text)
    };
  } catch (error) {
    return {
      ok: false,
      filePath,
      error: error.message
    };
  }
}

function getEventDetailHistoryJsonEntries() {
  const baseDirectoryPath = path.join(
    JSON_BASE_DIR,
    "event-detail-history"
  );

  if (!fs.existsSync(baseDirectoryPath)) {
    return [];
  }

  const entries = [];

  const eventDirectories = fs
    .readdirSync(
      baseDirectoryPath,
      {
        withFileTypes: true
      }
    )
    .filter(entry =>
      entry.isDirectory()
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );

  for (
    const eventDirectory of
    eventDirectories
  ) {
    const eventKey =
      eventDirectory.name;

    const eventDirectoryPath =
      path.join(
        baseDirectoryPath,
        eventKey
      );

    const files = fs
      .readdirSync(
        eventDirectoryPath,
        {
          withFileTypes: true
        }
      )
      .filter(entry =>
        entry.isFile() &&
        entry.name.endsWith(".json")
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    for (const file of files) {
      const detailHash =
        file.name.replace(
          /\.json$/i,
          ""
        );

      entries.push({
        eventKey,
        detailHash,
        filePath: path.join(
          eventDirectoryPath,
          file.name
        )
      });
    }
  }

  return entries;
}

function readEventDetailHistoryJsonEntry(
  entry
) {
  try {
    const text = fs.readFileSync(
      entry.filePath,
      "utf8"
    );

    return {
      ok: true,
      filePath: entry.filePath,
      data: JSON.parse(text)
    };
  } catch (error) {
    return {
      ok: false,
      filePath: entry.filePath,
      error: error.message
    };
  }
}

function createEventDetailHistoryKey(
  eventKey,
  detailHash
) {
  return (
    `${eventKey}::${detailHash}`
  );
}

function isValidEventKey(eventKey) {
  if (!eventKey) {
    return false;
  }

  const match = String(eventKey).match(
    /^(.+?)_(\d{8})_(\d{8})$/
  );

  if (!match) {
    return false;
  }

  const startDate = match[2];
  const endDate = match[3];

  if (startDate > endDate) {
    return false;
  }

  return true;
}

function isTestEventKey(eventKey) {
  return String(
    eventKey || ""
  ).startsWith(
    "test_"
  );
}

function isTestProfileId(profileId) {
  return String(
    profileId || ""
  ).startsWith(
    "test-profile-"
  );
}

function getEventKeyFromFileName(
  fileName
) {
  return fileName.replace(
    /\.json$/i,
    ""
  );
}

function getProfileIdFromFileName(
  fileName
) {
  return fileName.replace(
    /\.json$/i,
    ""
  );
}

function getSnapshotIdFromFileName(
  fileName
) {
  return fileName.replace(
    /\.json$/i,
    ""
  );
}

function printSection(title) {
  console.log("");

  console.log(
    "=".repeat(60)
  );

  console.log(title);

  console.log(
    "=".repeat(60)
  );
}

function printAction({
  mode,
  action,
  key,
  detail = ""
}) {
  const suffix = detail
    ? ` / ${detail}`
    : "";

  console.log(
    `[${mode}] ${action}: ${key}${suffix}`
  );
}

function reconcileEvents({
  database,
  options,
  summary
}) {
  printSection(
    "Events: JSON -> SQLite"
  );

  const files = getJsonFileNames(
    "events"
  );

  const existingKeys = new Set(
    database.db
      .prepare(`
        SELECT event_key
        FROM events
      `)
      .all()
      .map(row =>
        row.event_key
      )
  );

  const plannedEventKeys =
    new Set();

  for (const fileName of files) {
    const eventKey =
      getEventKeyFromFileName(
        fileName
      );

    if (isTestEventKey(eventKey)) {
      summary.events.skippedTest += 1;

      printAction({
        mode: "SKIP",
        action: "test event",
        key: eventKey
      });

      continue;
    }

    if (existingKeys.has(eventKey)) {
      summary.events.alreadyExists += 1;
      continue;
    }

    const result = readJsonFile(
      "events",
      fileName
    );

    if (!result.ok) {
      summary.events.errors += 1;

      printAction({
        mode: "ERROR",
        action: "read failed",
        key: eventKey,
        detail: result.error
      });

      continue;
    }

    const event = result.data;

    if (!isValidEventKey(eventKey)) {
      summary.events.skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action: "invalid eventKey",
        key: eventKey
      });

      continue;
    }

    if (
      !event?.eventKey ||
      !event?.eventId
    ) {
      summary.events.skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "missing required fields",
        key: eventKey
      });

      continue;
    }

    if (event.eventKey !== eventKey) {
      summary.events.skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "filename/eventKey mismatch",
        key: eventKey,
        detail:
          `data=${event.eventKey}`
      });

      continue;
    }

    plannedEventKeys.add(eventKey);

    if (options.dryRun) {
      summary.events.wouldAdd += 1;

      printAction({
        mode: "DRY-RUN",
        action: "would add event",
        key: eventKey
      });

      continue;
    }

    try {
      database.upsertEvent(event);

      summary.events.added += 1;

      printAction({
        mode: "APPLY",
        action: "added event",
        key: eventKey
      });
    } catch (error) {
      summary.events.errors += 1;

      plannedEventKeys.delete(
        eventKey
      );

      printAction({
        mode: "ERROR",
        action:
          "event insert failed",
        key: eventKey,
        detail: error.message
      });
    }
  }

  return plannedEventKeys;
}

function reconcileEventDetails({
  database,
  options,
  summary,
  plannedEventKeys
}) {
  printSection(
    "Event details: JSON -> SQLite"
  );

  const files = getJsonFileNames(
    "event-details"
  );

  const existingKeys = new Set(
    database.db
      .prepare(`
        SELECT event_key
        FROM event_details
      `)
      .all()
      .map(row =>
        row.event_key
      )
  );

  const sqliteEventKeys = new Set(
    database.db
      .prepare(`
        SELECT event_key
        FROM events
      `)
      .all()
      .map(row =>
        row.event_key
      )
  );

  for (
    const eventKey of
    plannedEventKeys
  ) {
    sqliteEventKeys.add(eventKey);
  }

  for (const fileName of files) {
    const eventKey =
      getEventKeyFromFileName(
        fileName
      );

    if (isTestEventKey(eventKey)) {
      summary
        .eventDetails
        .skippedTest += 1;

      printAction({
        mode: "SKIP",
        action:
          "test event detail",
        key: eventKey
      });

      continue;
    }

    if (existingKeys.has(eventKey)) {
      summary
        .eventDetails
        .alreadyExists += 1;

      continue;
    }

    if (!isValidEventKey(eventKey)) {
      summary
        .eventDetails
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action: "invalid eventKey",
        key: eventKey
      });

      continue;
    }

    if (
      !sqliteEventKeys.has(
        eventKey
      )
    ) {
      summary
        .eventDetails
        .skippedMissingParent += 1;

      printAction({
        mode: "SKIP",
        action:
          "parent event missing",
        key: eventKey
      });

      continue;
    }

    const result = readJsonFile(
      "event-details",
      fileName
    );

    if (!result.ok) {
      summary
        .eventDetails
        .errors += 1;

      printAction({
        mode: "ERROR",
        action: "read failed",
        key: eventKey,
        detail: result.error
      });

      continue;
    }

    const detail = result.data;

    if (
      !detail?.eventKey ||
      detail.eventKey !== eventKey
    ) {
      summary
        .eventDetails
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "filename/eventKey mismatch",
        key: eventKey,
        detail:
          `data=${
            detail?.eventKey ||
            "missing"
          }`
      });

      continue;
    }

    if (options.dryRun) {
      summary
        .eventDetails
        .wouldAdd += 1;

      printAction({
        mode: "DRY-RUN",
        action:
          "would add event detail",
        key: eventKey
      });

      continue;
    }

    try {
      database.upsertEventDetail({
        ...detail,

        capturedAt:
          detail.detailCapturedAt ||
          detail.capturedAt ||
          null
      });

      summary
        .eventDetails
        .added += 1;

      printAction({
        mode: "APPLY",
        action:
          "added event detail",
        key: eventKey
      });
    } catch (error) {
      summary
        .eventDetails
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "event detail insert failed",
        key: eventKey,
        detail: error.message
      });
    }
  }
}

function reconcileEventDetailHistoryJsonToSqlite({
  database,
  options,
  summary,
  plannedEventKeys
}) {
  printSection(
    "Event detail history: JSON -> SQLite"
  );

  const jsonEntries =
    getEventDetailHistoryJsonEntries();

  const existingHistoryKeys =
    new Set(
      database.db
        .prepare(`
          SELECT
            event_key,
            detail_hash
          FROM event_detail_history
        `)
        .all()
        .map(row =>
          createEventDetailHistoryKey(
            row.event_key,
            row.detail_hash
          )
        )
    );

  const sqliteEventKeys =
    new Set(
      database.db
        .prepare(`
          SELECT event_key
          FROM events
        `)
        .all()
        .map(row =>
          row.event_key
        )
    );

  for (
    const eventKey of
    plannedEventKeys
  ) {
    sqliteEventKeys.add(eventKey);
  }

  for (const entry of jsonEntries) {
    const {
      eventKey,
      detailHash
    } = entry;

    const historyKey =
      createEventDetailHistoryKey(
        eventKey,
        detailHash
      );

    if (isTestEventKey(eventKey)) {
      summary
        .eventDetailHistoryJsonToSqlite
        .skippedTest += 1;

      printAction({
        mode: "SKIP",
        action:
          "test event detail history",
        key: historyKey
      });

      continue;
    }

    if (
      existingHistoryKeys.has(
        historyKey
      )
    ) {
      summary
        .eventDetailHistoryJsonToSqlite
        .alreadyExists += 1;

      continue;
    }

    if (!isValidEventKey(eventKey)) {
      summary
        .eventDetailHistoryJsonToSqlite
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action: "invalid eventKey",
        key: historyKey
      });

      continue;
    }

    if (!detailHash) {
      summary
        .eventDetailHistoryJsonToSqlite
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "missing detailHash",
        key: historyKey
      });

      continue;
    }

    if (
      !sqliteEventKeys.has(
        eventKey
      )
    ) {
      summary
        .eventDetailHistoryJsonToSqlite
        .skippedMissingParent += 1;

      printAction({
        mode: "SKIP",
        action:
          "parent event missing",
        key: historyKey
      });

      continue;
    }

    const result =
      readEventDetailHistoryJsonEntry(
        entry
      );

    if (!result.ok) {
      summary
        .eventDetailHistoryJsonToSqlite
        .errors += 1;

      printAction({
        mode: "ERROR",
        action: "read failed",
        key: historyKey,
        detail: result.error
      });

      continue;
    }

    const detail = result.data;

    if (
      !detail?.eventKey ||
      detail.eventKey !== eventKey
    ) {
      summary
        .eventDetailHistoryJsonToSqlite
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "directory/eventKey mismatch",
        key: historyKey,
        detail:
          `data=${
            detail?.eventKey ||
            "missing"
          }`
      });

      continue;
    }

    if (
      !detail?.detailHash ||
      detail.detailHash !== detailHash
    ) {
      summary
        .eventDetailHistoryJsonToSqlite
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "filename/detailHash mismatch",
        key: historyKey,
        detail:
          `data=${
            detail?.detailHash ||
            "missing"
          }`
      });

      continue;
    }

    if (options.dryRun) {
      summary
        .eventDetailHistoryJsonToSqlite
        .wouldAdd += 1;

      printAction({
        mode: "DRY-RUN",
        action:
          "would add event detail history row",
        key: historyKey
      });

      continue;
    }

    try {
      const saveResult =
        database.saveEventDetailHistory({
          ...detail,

          capturedAt:
            detail.detailCapturedAt ||
            detail.capturedAt ||
            null
        });

      if (saveResult.saved) {
        summary
          .eventDetailHistoryJsonToSqlite
          .added += 1;

        existingHistoryKeys.add(
          historyKey
        );

        printAction({
          mode: "APPLY",
          action:
            "added event detail history row",
          key: historyKey
        });
      } else {
        summary
          .eventDetailHistoryJsonToSqlite
          .alreadyExists += 1;
      }
    } catch (error) {
      summary
        .eventDetailHistoryJsonToSqlite
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "event detail history insert failed",
        key: historyKey,
        detail: error.message
      });
    }
  }
}

function reconcileEventDetailHistorySqliteToJson({
  database,
  storage,
  options,
  summary
}) {
  printSection(
    "Event detail history: SQLite -> JSON"
  );

  const jsonHistoryKeys =
    new Set(
      getEventDetailHistoryJsonEntries()
        .map(entry =>
          createEventDetailHistoryKey(
            entry.eventKey,
            entry.detailHash
          )
        )
    );

  const rows = database.db
    .prepare(`
      SELECT
        event_key,
        detail_hash,
        raw_text,
        sections_json,
        captured_at,
        created_at
      FROM event_detail_history
      ORDER BY
        event_key ASC,
        captured_at ASC,
        detail_hash ASC
    `)
    .all();

  for (const row of rows) {
    const eventKey =
      row.event_key;

    const detailHash =
      row.detail_hash;

    const historyKey =
      createEventDetailHistoryKey(
        eventKey,
        detailHash
      );

    if (isTestEventKey(eventKey)) {
      summary
        .eventDetailHistorySqliteToJson
        .skippedTest += 1;

      printAction({
        mode: "SKIP",
        action:
          "test event detail history",
        key: historyKey
      });

      continue;
    }

    if (
      jsonHistoryKeys.has(
        historyKey
      )
    ) {
      summary
        .eventDetailHistorySqliteToJson
        .alreadyExists += 1;

      continue;
    }

    if (!isValidEventKey(eventKey)) {
      summary
        .eventDetailHistorySqliteToJson
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action: "invalid eventKey",
        key: historyKey
      });

      continue;
    }

    if (!detailHash) {
      summary
        .eventDetailHistorySqliteToJson
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "missing detailHash",
        key: historyKey
      });

      continue;
    }

    let sections = [];

    if (row.sections_json) {
      try {
        const parsed =
          JSON.parse(
            row.sections_json
          );

        sections =
          Array.isArray(parsed)
            ? parsed
            : [];
      } catch (error) {
        summary
          .eventDetailHistorySqliteToJson
          .errors += 1;

        printAction({
          mode: "ERROR",
          action:
            "sections_json parse failed",
          key: historyKey,
          detail: error.message
        });

        continue;
      }
    }

    const detail = {
      eventKey,

      detailHash,

      rawText:
        row.raw_text || "",

      sections,

      detailCapturedAt:
        row.captured_at || null,

      capturedAt:
        row.captured_at || null,

      createdAt:
        row.created_at || null
    };

    if (options.dryRun) {
      summary
        .eventDetailHistorySqliteToJson
        .wouldAdd += 1;

      printAction({
        mode: "DRY-RUN",
        action:
          "would add event detail history JSON",
        key: historyKey
      });

      continue;
    }

    try {
      const saveResult =
        storage.saveEventDetailHistory(
          detail
        );

      if (saveResult.saved) {
        summary
          .eventDetailHistorySqliteToJson
          .added += 1;

        jsonHistoryKeys.add(
          historyKey
        );

        printAction({
          mode: "APPLY",
          action:
            "added event detail history JSON",
          key: historyKey
        });
      } else {
        summary
          .eventDetailHistorySqliteToJson
          .alreadyExists += 1;
      }
    } catch (error) {
      summary
        .eventDetailHistorySqliteToJson
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "event detail history JSON save failed",
        key: historyKey,
        detail: error.message
      });
    }
  }
}

function reconcilePageCache({
  database,
  options,
  summary,
  plannedEventKeys
}) {
  printSection(
    "Page cache: JSON -> SQLite"
  );

  const files = getJsonFileNames(
    "page-cache"
  );

  const existingKeys = new Set(
    database.db
      .prepare(`
        SELECT event_key
        FROM page_cache
      `)
      .all()
      .map(row =>
        row.event_key
      )
  );

  const sqliteEventKeys = new Set(
    database.db
      .prepare(`
        SELECT event_key
        FROM events
      `)
      .all()
      .map(row =>
        row.event_key
      )
  );

  for (
    const eventKey of
    plannedEventKeys
  ) {
    sqliteEventKeys.add(eventKey);
  }

  for (const fileName of files) {
    const eventKey =
      getEventKeyFromFileName(
        fileName
      );

    if (isTestEventKey(eventKey)) {
      summary
        .pageCache
        .skippedTest += 1;

      printAction({
        mode: "SKIP",
        action:
          "test page cache",
        key: eventKey
      });

      continue;
    }

    if (existingKeys.has(eventKey)) {
      summary
        .pageCache
        .alreadyExists += 1;

      continue;
    }

    if (!isValidEventKey(eventKey)) {
      summary
        .pageCache
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "invalid eventKey",
        key: eventKey
      });

      continue;
    }

    if (
      !sqliteEventKeys.has(
        eventKey
      )
    ) {
      summary
        .pageCache
        .skippedMissingParent += 1;

      printAction({
        mode: "SKIP",
        action:
          "parent event missing",
        key: eventKey
      });

      continue;
    }

    const result = readJsonFile(
      "page-cache",
      fileName
    );

    if (!result.ok) {
      summary
        .pageCache
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "read failed",
        key: eventKey,
        detail: result.error
      });

      continue;
    }

    const pageCache = result.data;

    if (
      !pageCache?.eventKey ||
      pageCache.eventKey !== eventKey
    ) {
      summary
        .pageCache
        .skippedInvalid += 1;

      printAction({
        mode: "SKIP",
        action:
          "filename/eventKey mismatch",
        key: eventKey,
        detail:
          `data=${
            pageCache?.eventKey ||
            "missing"
          }`
      });

      continue;
    }

    if (options.dryRun) {
      summary
        .pageCache
        .wouldAdd += 1;

      printAction({
        mode: "DRY-RUN",
        action:
          "would add page cache",
        key: eventKey
      });

      continue;
    }

    try {
      database.upsertPageCache(
        pageCache
      );

      summary
        .pageCache
        .added += 1;

      printAction({
        mode: "APPLY",
        action:
          "added page cache",
        key: eventKey
      });
    } catch (error) {
      summary
        .pageCache
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "page cache insert failed",
        key: eventKey,
        detail: error.message
      });
    }
  }
}

function reconcileLivers({
  database,
  storage,
  options,
  summary
}) {
  printSection(
    "Livers: SQLite -> JSON"
  );

  const jsonProfileIds =
    new Set(
      getJsonFileNames("livers")
        .map(
          getProfileIdFromFileName
        )
    );

  const sqliteLivers = database.db
    .prepare(`
      SELECT
        profile_id,
        current_name,
        profile_url,
        icon_url,
        first_seen_at,
        last_seen_at
      FROM livers
      ORDER BY profile_id
    `)
    .all();

  const nameHistoryStatement =
    database.db.prepare(`
      SELECT
        name,
        first_seen_at,
        last_seen_at
      FROM liver_names
      WHERE profile_id = ?
      ORDER BY first_seen_at ASC
    `);

  const eventKeysStatement =
    database.db.prepare(`
      SELECT DISTINCT
        s.event_key
      FROM ranking_entries re
      INNER JOIN snapshots s
        ON s.snapshot_id = re.snapshot_id
      WHERE re.profile_id = ?
      ORDER BY s.event_key
    `);

  for (const row of sqliteLivers) {
    const profileId =
      row.profile_id;

    if (isTestProfileId(profileId)) {
      summary
        .livers
        .skippedTest += 1;

      printAction({
        mode: "SKIP",
        action: "test liver",
        key: profileId
      });

      continue;
    }

    if (
      jsonProfileIds.has(
        profileId
      )
    ) {
      summary
        .livers
        .alreadyExists += 1;

      continue;
    }

    const nameHistory =
      nameHistoryStatement
        .all(profileId)
        .map(item => ({
          name: item.name,

          firstSeenAt:
            item.first_seen_at ||
            null,

          lastSeenAt:
            item.last_seen_at ||
            null
        }));

    const eventKeys =
      eventKeysStatement
        .all(profileId)
        .map(item =>
          item.event_key
        )
        .filter(eventKey =>
          !isTestEventKey(
            eventKey
          )
        );

    const liver = {
      profileId,

      currentName:
        row.current_name || "",

      nameHistory,

      profileUrl:
        row.profile_url || null,

      iconUrl:
        row.icon_url || null,

      firstSeenAt:
        row.first_seen_at || null,

      lastSeenAt:
        row.last_seen_at || null,

      eventKeys
    };

    if (options.dryRun) {
      summary
        .livers
        .wouldAdd += 1;

      printAction({
        mode: "DRY-RUN",
        action:
          "would add liver JSON",
        key: profileId
      });

      continue;
    }

    try {
      storage.saveLiver(liver);

      summary
        .livers
        .added += 1;

      printAction({
        mode: "APPLY",
        action:
          "added liver JSON",
        key: profileId
      });
    } catch (error) {
      summary
        .livers
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "liver JSON save failed",
        key: profileId,
        detail: error.message
      });
    }
  }
}

function reconcileSnapshots({
  database,
  storage,
  options,
  summary
}) {
  printSection(
    "Snapshots: SQLite -> JSON"
  );

  const jsonSnapshotIds =
    new Set(
      getJsonFileNames(
        "snapshots"
      ).map(
        getSnapshotIdFromFileName
      )
    );

  const snapshots = database.db
    .prepare(`
      SELECT
        snapshot_id,
        event_key,
        captured_at,
        scheduled_at,
        duration_ms,
        status,
        ranking_hash
      FROM snapshots
      ORDER BY
        event_key ASC,
        captured_at ASC
    `)
    .all();

  const eventStatement =
    database.db.prepare(`
      SELECT
        event_id
      FROM events
      WHERE event_key = ?
      LIMIT 1
    `);

  const entriesStatement =
    database.db.prepare(`
      SELECT
        re.rank,
        re.profile_id,
        l.profile_url,
        l.current_name,
        re.point,
        l.icon_url
      FROM ranking_entries re
      INNER JOIN livers l
        ON l.profile_id = re.profile_id
      WHERE re.snapshot_id = ?
      ORDER BY re.rank ASC
    `);

  const seenRankingHashesByEvent =
    new Map();

  for (const row of snapshots) {
    const snapshotId =
      row.snapshot_id;

    const eventKey =
      row.event_key;

    if (isTestEventKey(eventKey)) {
      summary
        .snapshots
        .skippedTest += 1;

      printAction({
        mode: "SKIP",
        action:
          "test snapshot",
        key: snapshotId,
        detail: eventKey
      });

      continue;
    }

    if (
      jsonSnapshotIds.has(
        snapshotId
      )
    ) {
      summary
        .snapshots
        .alreadyExists += 1;

      if (row.ranking_hash) {
        if (
          !seenRankingHashesByEvent
            .has(eventKey)
        ) {
          seenRankingHashesByEvent.set(
            eventKey,
            new Set()
          );
        }

        seenRankingHashesByEvent
          .get(eventKey)
          .add(
            row.ranking_hash
          );
      }

      continue;
    }

    if (
      !seenRankingHashesByEvent
        .has(eventKey)
    ) {
      seenRankingHashesByEvent.set(
        eventKey,
        new Set()
      );
    }

    const seenHashes =
      seenRankingHashesByEvent.get(
        eventKey
      );

    if (
      row.ranking_hash &&
      seenHashes.has(
        row.ranking_hash
      )
    ) {
      summary
        .snapshots
        .skippedDuplicateHash += 1;

      printAction({
        mode: "SKIP",
        action:
          "duplicate rankingHash",
        key: snapshotId,
        detail: eventKey
      });

      continue;
    }

    const event =
      eventStatement.get(
        eventKey
      );

    if (!event) {
      summary
        .snapshots
        .skippedMissingParent += 1;

      printAction({
        mode: "SKIP",
        action:
          "parent event missing",
        key: snapshotId,
        detail: eventKey
      });

      continue;
    }

    const entries =
      entriesStatement
        .all(snapshotId)
        .map(item => ({
          rank:
            item.rank,

          profileId:
            item.profile_id,

          profileUrl:
            item.profile_url ||
            null,

          name:
            item.current_name ||
            "",

          point:
            item.point,

          iconUrl:
            item.icon_url ||
            null
        }));

    const snapshot = {
      snapshotId,

      eventKey,

      eventId:
        event.event_id,

      capturedAt:
        row.captured_at ||
        null,

      scheduledAt:
        row.scheduled_at ||
        null,

      durationMs:
        row.duration_ms ??
        null,

      status:
        row.status ||
        null,

      rankingHash:
        row.ranking_hash ||
        null,

      entryCount:
        entries.length,

      entries
    };

    if (options.dryRun) {
      summary
        .snapshots
        .wouldAdd += 1;

      if (row.ranking_hash) {
        seenHashes.add(
          row.ranking_hash
        );
      }

      printAction({
        mode: "DRY-RUN",
        action:
          "would add snapshot JSON",
        key: snapshotId,
        detail:
          `${eventKey} / ` +
          `entries=${entries.length}`
      });

      continue;
    }

    try {
      storage.saveSnapshot(
        snapshot
      );

      summary
        .snapshots
        .added += 1;

      if (row.ranking_hash) {
        seenHashes.add(
          row.ranking_hash
        );
      }

      printAction({
        mode: "APPLY",
        action:
          "added snapshot JSON",
        key: snapshotId,
        detail:
          `${eventKey} / ` +
          `entries=${entries.length}`
      });
    } catch (error) {
      summary
        .snapshots
        .errors += 1;

      printAction({
        mode: "ERROR",
        action:
          "snapshot JSON save failed",
        key: snapshotId,
        detail: error.message
      });
    }
  }
}

function createSummary() {
  return {
    events: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedInvalid: 0,
      skippedTest: 0,
      errors: 0
    },

    eventDetails: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedInvalid: 0,
      skippedMissingParent: 0,
      skippedTest: 0,
      errors: 0
    },

    eventDetailHistoryJsonToSqlite: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedInvalid: 0,
      skippedMissingParent: 0,
      skippedTest: 0,
      errors: 0
    },

    eventDetailHistorySqliteToJson: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedInvalid: 0,
      skippedTest: 0,
      errors: 0
    },

    pageCache: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedInvalid: 0,
      skippedMissingParent: 0,
      skippedTest: 0,
      errors: 0
    },

    livers: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedTest: 0,
      errors: 0
    },

    snapshots: {
      alreadyExists: 0,
      wouldAdd: 0,
      added: 0,
      skippedMissingParent: 0,
      skippedDuplicateHash: 0,
      skippedTest: 0,
      errors: 0
    }
  };
}

function main() {
  const options = parseArgs(
    process.argv.slice(2)
  );

  console.log(
    "MixArchive JSON / SQLite reconciliation"
  );

  console.log("");

  console.log("Mode:");

  console.log(
    options.dryRun
      ? "DRY-RUN"
      : "APPLY"
  );

  if (options.dryRun) {
    console.log("");

    console.log(
      "No files or database rows will be changed."
    );
  }

  const storage =
    new Storage();

  const database =
    new MixArchiveDatabase();

  const summary =
    createSummary();

  try {
    const plannedEventKeys =
      reconcileEvents({
        database,
        options,
        summary
      });

    reconcileEventDetails({
      database,
      options,
      summary,
      plannedEventKeys
    });

    reconcileEventDetailHistoryJsonToSqlite({
      database,
      options,
      summary,
      plannedEventKeys
    });

    reconcileEventDetailHistorySqliteToJson({
      database,
      storage,
      options,
      summary
    });

    reconcilePageCache({
      database,
      options,
      summary,
      plannedEventKeys
    });

    reconcileLivers({
      database,
      storage,
      options,
      summary
    });

    reconcileSnapshots({
      database,
      storage,
      options,
      summary
    });
  } finally {
    database.close();
  }

  printSection(
    "Summary"
  );

  console.log(summary);

  console.log("");

  if (options.dryRun) {
    console.log(
      "DRY-RUN completed. No data was changed."
    );

    console.log("");

    console.log(
      "Review the output before using --apply."
    );
  } else {
    console.log(
      "Reconciliation completed."
    );
  }
}

try {
  main();
} catch (error) {
  console.error(
    "Reconciliation failed."
  );

  console.error(error);

  process.exit(1);
}