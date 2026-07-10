import fs from "fs";
import path from "path";

import { MixArchiveDatabase } from "../lib/database.js";

const JSON_BASE_DIR = "data/current";

const EXPECTED_JSON_ONLY_EVENT_DETAIL_KEYS = new Set([
  "14521_20260623_20260706",
  "14521_20260705_20260623"
]);

function getJsonKeys(directoryName) {
  const directoryPath = path.join(
    JSON_BASE_DIR,
    directoryName
  );

  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter(fileName => fileName.endsWith(".json"))
    .map(fileName =>
      fileName.replace(/\.json$/i, "")
    )
    .sort();
}

function getEventDetailHistoryJsonKeys() {
  const baseDirectoryPath = path.join(
    JSON_BASE_DIR,
    "event-detail-history"
  );

  if (!fs.existsSync(baseDirectoryPath)) {
    return [];
  }

  const keys = [];

  const eventDirectories = fs
    .readdirSync(
      baseDirectoryPath,
      {
        withFileTypes: true
      }
    )
    .filter(entry => entry.isDirectory());

  for (const eventDirectory of eventDirectories) {
    const eventKey =
      eventDirectory.name;

    const eventDirectoryPath = path.join(
      baseDirectoryPath,
      eventKey
    );

    const detailHashFiles = fs
      .readdirSync(eventDirectoryPath)
      .filter(fileName =>
        fileName.endsWith(".json")
      );

    for (const fileName of detailHashFiles) {
      const detailHash =
        fileName.replace(
          /\.json$/i,
          ""
        );

      keys.push(
        createEventDetailHistoryKey(
          eventKey,
          detailHash
        )
      );
    }
  }

  return keys.sort();
}

function createEventDetailHistoryKey(
  eventKey,
  detailHash
) {
  return `${eventKey}::${detailHash}`;
}

function parseEventDetailHistoryKey(key) {
  const separatorIndex =
    String(key || "").indexOf("::");

  if (separatorIndex < 0) {
    return {
      eventKey: "",
      detailHash: ""
    };
  }

  return {
    eventKey:
      key.slice(
        0,
        separatorIndex
      ),

    detailHash:
      key.slice(
        separatorIndex + 2
      )
  };
}

function isTestEventKey(key) {
  return String(key || "").startsWith(
    "test_"
  );
}

function isTestProfileId(key) {
  return String(key || "").startsWith(
    "test-profile-"
  );
}

function compareKeys({
  label,
  jsonKeys,
  sqliteKeys,
  classifyOnlyInJson = null,
  classifyOnlyInSqlite = null
}) {
  const jsonSet = new Set(jsonKeys);
  const sqliteSet = new Set(sqliteKeys);

  const onlyInJson = jsonKeys.filter(
    key => !sqliteSet.has(key)
  );

  const onlyInSqlite = sqliteKeys.filter(
    key => !jsonSet.has(key)
  );

  const expectedOnlyInJson = [];
  const unexpectedOnlyInJson = [];

  const expectedOnlyInSqlite = [];
  const unexpectedOnlyInSqlite = [];

  for (const key of onlyInJson) {
    const expected = classifyOnlyInJson
      ? classifyOnlyInJson(key)
      : false;

    if (expected) {
      expectedOnlyInJson.push({
        key,
        reason: expected
      });
    } else {
      unexpectedOnlyInJson.push(key);
    }
  }

  for (const key of onlyInSqlite) {
    const expected = classifyOnlyInSqlite
      ? classifyOnlyInSqlite(key)
      : false;

    if (expected) {
      expectedOnlyInSqlite.push({
        key,
        reason: expected
      });
    } else {
      unexpectedOnlyInSqlite.push(key);
    }
  }

  return {
    label,

    jsonCount: jsonKeys.length,

    sqliteCount: sqliteKeys.length,

    countsMatch:
      jsonKeys.length === sqliteKeys.length,

    rawKeysMatch:
      onlyInJson.length === 0 &&
      onlyInSqlite.length === 0,

    effectiveKeysMatch:
      unexpectedOnlyInJson.length === 0 &&
      unexpectedOnlyInSqlite.length === 0,

    onlyInJson,
    onlyInSqlite,

    expectedOnlyInJson,
    expectedOnlyInSqlite,

    unexpectedOnlyInJson,
    unexpectedOnlyInSqlite
  };
}

function printKeyList({
  title,
  items,
  getKey,
  getReason = null
}) {
  if (items.length === 0) {
    return;
  }

  console.log("");
  console.log(`  ${title}:`);

  for (const item of items.slice(0, 10)) {
    const key = getKey(item);

    if (getReason) {
      console.log(
        `    ${key} / ${getReason(item)}`
      );
    } else {
      console.log(`    ${key}`);
    }
  }

  if (items.length > 10) {
    console.log(
      `    ... and ${items.length - 10} more`
    );
  }
}

function printResult(result) {
  console.log(result.label);

  console.log(
    `  JSON:   ${result.jsonCount}`
  );

  console.log(
    `  SQLite: ${result.sqliteCount}`
  );

  console.log(
    `  Raw count match: ${result.countsMatch}`
  );

  console.log(
    `  Raw key match:   ${result.rawKeysMatch}`
  );

  console.log(
    `  Effective match: ${result.effectiveKeysMatch}`
  );

  printKeyList({
    title: "Expected only in JSON",
    items: result.expectedOnlyInJson,
    getKey: item => item.key,
    getReason: item => item.reason
  });

  printKeyList({
    title: "Expected only in SQLite",
    items: result.expectedOnlyInSqlite,
    getKey: item => item.key,
    getReason: item => item.reason
  });

  printKeyList({
    title: "UNEXPECTED only in JSON",
    items: result.unexpectedOnlyInJson,
    getKey: item => item
  });

  printKeyList({
    title: "UNEXPECTED only in SQLite",
    items: result.unexpectedOnlyInSqlite,
    getKey: item => item
  });

  console.log("");
}

function getDuplicateSnapshotIds(database) {
  const snapshots = database.db
    .prepare(`
      SELECT
        snapshot_id,
        event_key,
        ranking_hash,
        captured_at
      FROM snapshots
      WHERE ranking_hash IS NOT NULL
      ORDER BY
        event_key ASC,
        captured_at ASC
    `)
    .all();

  const seenHashesByEvent = new Map();
  const duplicateSnapshotIds = new Set();

  for (const snapshot of snapshots) {
    const eventKey = snapshot.event_key;
    const rankingHash = snapshot.ranking_hash;

    if (!seenHashesByEvent.has(eventKey)) {
      seenHashesByEvent.set(
        eventKey,
        new Set()
      );
    }

    const seenHashes =
      seenHashesByEvent.get(eventKey);

    if (seenHashes.has(rankingHash)) {
      duplicateSnapshotIds.add(
        snapshot.snapshot_id
      );

      continue;
    }

    seenHashes.add(rankingHash);
  }

  return duplicateSnapshotIds;
}

function main() {
  console.log(
    "MixArchive JSON / SQLite consistency check"
  );

  console.log("");

  const database = new MixArchiveDatabase();

  try {
    //
    // JSON keys
    //

    const jsonEventKeys =
      getJsonKeys("events");

    const jsonEventDetailKeys =
      getJsonKeys("event-details");

    const jsonEventDetailHistoryKeys =
      getEventDetailHistoryJsonKeys();

    const jsonPageCacheKeys =
      getJsonKeys("page-cache");

    const jsonLiverKeys =
      getJsonKeys("livers");

    const jsonSnapshotKeys =
      getJsonKeys("snapshots");

    //
    // SQLite keys
    //

    const sqliteEventKeys = database.db
      .prepare(`
        SELECT event_key
        FROM events
        ORDER BY event_key
      `)
      .all()
      .map(row => row.event_key);

    const sqliteEventDetailKeys = database.db
      .prepare(`
        SELECT event_key
        FROM event_details
        ORDER BY event_key
      `)
      .all()
      .map(row => row.event_key);

    const sqliteEventDetailHistoryKeys =
      database.db
        .prepare(`
          SELECT
            event_key,
            detail_hash
          FROM event_detail_history
          ORDER BY
            event_key,
            detail_hash
        `)
        .all()
        .map(row =>
          createEventDetailHistoryKey(
            row.event_key,
            row.detail_hash
          )
        );

    const sqlitePageCacheKeys = database.db
      .prepare(`
        SELECT event_key
        FROM page_cache
        ORDER BY event_key
      `)
      .all()
      .map(row => row.event_key);

    const sqliteLiverKeys = database.db
      .prepare(`
        SELECT profile_id
        FROM livers
        ORDER BY profile_id
      `)
      .all()
      .map(row => row.profile_id);

    const sqliteSnapshotKeys = database.db
      .prepare(`
        SELECT snapshot_id
        FROM snapshots
        ORDER BY snapshot_id
      `)
      .all()
      .map(row => row.snapshot_id);

    const duplicateSnapshotIds =
      getDuplicateSnapshotIds(database);

    //
    // Compare
    //

    const results = [
      compareKeys({
        label: "Events",

        jsonKeys: jsonEventKeys,

        sqliteKeys: sqliteEventKeys,

        classifyOnlyInSqlite: key => {
          if (isTestEventKey(key)) {
            return "test event";
          }

          return false;
        }
      }),

      compareKeys({
        label: "Event details",

        jsonKeys: jsonEventDetailKeys,

        sqliteKeys: sqliteEventDetailKeys,

        classifyOnlyInJson: key => {
          if (
            EXPECTED_JSON_ONLY_EVENT_DETAIL_KEYS.has(
              key
            )
          ) {
            return "known invalid or orphan event detail";
          }

          return false;
        },

        classifyOnlyInSqlite: key => {
          if (isTestEventKey(key)) {
            return "test event detail";
          }

          return false;
        }
      }),

      compareKeys({
        label: "Event detail history",

        jsonKeys:
          jsonEventDetailHistoryKeys,

        sqliteKeys:
          sqliteEventDetailHistoryKeys,

        classifyOnlyInSqlite: key => {
          const {
            eventKey
          } =
            parseEventDetailHistoryKey(
              key
            );

          if (isTestEventKey(eventKey)) {
            return "test event detail history";
          }

          return false;
        }
      }),

      compareKeys({
        label: "Page cache",

        jsonKeys: jsonPageCacheKeys,

        sqliteKeys: sqlitePageCacheKeys,

        classifyOnlyInSqlite: key => {
          if (isTestEventKey(key)) {
            return "test page cache";
          }

          return false;
        }
      }),

      compareKeys({
        label: "Livers",

        jsonKeys: jsonLiverKeys,

        sqliteKeys: sqliteLiverKeys,

        classifyOnlyInSqlite: key => {
          if (isTestProfileId(key)) {
            return "test liver";
          }

          return false;
        }
      }),

      compareKeys({
        label: "Snapshots",

        jsonKeys: jsonSnapshotKeys,

        sqliteKeys: sqliteSnapshotKeys,

        classifyOnlyInSqlite: key => {
          if (
            duplicateSnapshotIds.has(key)
          ) {
            return "duplicate rankingHash snapshot";
          }

          const snapshot = database.db
            .prepare(`
              SELECT
                event_key
              FROM snapshots
              WHERE snapshot_id = ?
              LIMIT 1
            `)
            .get(key);

          if (
            snapshot &&
            isTestEventKey(snapshot.event_key)
          ) {
            return "test snapshot";
          }

          return false;
        }
      })
    ];

    for (const result of results) {
      printResult(result);
    }

    const unexpectedDifferences =
      results.reduce(
        (total, result) => {
          return total +
            result.unexpectedOnlyInJson.length +
            result.unexpectedOnlyInSqlite.length;
        },
        0
      );

    const expectedDifferences =
      results.reduce(
        (total, result) => {
          return total +
            result.expectedOnlyInJson.length +
            result.expectedOnlyInSqlite.length;
        },
        0
      );

    const allEffectiveKeysMatch =
      results.every(
        result => result.effectiveKeysMatch
      );

    console.log("Summary:");

    console.log({
      allEffectiveKeysMatch,
      unexpectedDifferences,
      expectedDifferences
    });

    console.log("");

    if (allEffectiveKeysMatch) {
      if (expectedDifferences > 0) {
        console.log(
          "Consistency check passed with expected differences."
        );
      } else {
        console.log(
          "Consistency check passed."
        );
      }

      return;
    }

    console.log(
      "Unexpected consistency differences detected."
    );

    process.exitCode = 1;
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error(
    "Consistency check failed."
  );

  console.error(error);

  process.exit(1);
}