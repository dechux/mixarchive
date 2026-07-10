import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  Storage
} from "../lib/storage.js";

import {
  MixArchiveDatabase
} from "../lib/database.js";

import {
  ArchiveUpdateService
} from "../lib/archiveUpdateService.js";

import {
  RankingService
} from "../lib/rankingService.js";

const SOURCE_DATA_DIR =
  path.join(
    "data",
    "current"
  );

const TEMP_ROOT_DIR =
  path.join(
    ".tmp",
    "ranking-fail-safe-test"
  );

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

function getSnapshotCount(
  database,
  eventKey
) {
  const row =
    database.db
      .prepare(`
        SELECT
          COUNT(*) AS count
        FROM snapshots
        WHERE event_key = ?
      `)
      .get(eventKey);

  return row?.count ?? 0;
}

function getRankingEntryCount(
  database,
  eventKey
) {
  const row =
    database.db
      .prepare(`
        SELECT
          COUNT(*) AS count

        FROM ranking_entries re

        INNER JOIN snapshots s
          ON s.snapshot_id =
            re.snapshot_id

        WHERE
          s.event_key = ?
      `)
      .get(eventKey);

  return row?.count ?? 0;
}

function getLiverCount(
  database
) {
  return getTableCount(
    database,
    "livers"
  );
}

function getSourceEventKeys() {
  const pageCacheDirectory =
    path.join(
      SOURCE_DATA_DIR,
      "page-cache"
    );

  if (
    !fs.existsSync(
      pageCacheDirectory
    )
  ) {
    return [];
  }

  return fs
    .readdirSync(
      pageCacheDirectory,
      {
        withFileTypes: true
      }
    )
    .filter(entry =>
      entry.isFile() &&
      entry.name.endsWith(".json")
    )
    .map(entry =>
      entry.name.replace(
        /\.json$/i,
        ""
      )
    )
    .sort();
}

function findUsableSourceSample(
  sourceStorage
) {
  const eventKeys =
    getSourceEventKeys();

  for (const eventKey of eventKeys) {
    const event =
      sourceStorage.readEvent(
        eventKey
      );

    const pageContent =
      sourceStorage.readPageCache(
        eventKey
      );

    if (
      !event ||
      !pageContent
    ) {
      continue;
    }

    if (
      !event.eventKey ||
      !event.eventId ||
      !event.eventUrl
    ) {
      continue;
    }

    try {
      const ranking =
        RankingService.fetch({
          pageContent,
          event
        });

      if (
        ranking.entryCount > 0
      ) {
        return {
          event,
          pageContent,
          ranking
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function createEmptyRankingPageContent(
  pageContent
) {
  return {
    ...pageContent,

    rankingHtml: ""
  };
}

function verifyFirstPass({
  storage,
  database,
  result
}) {
  assert.equal(
    result.ranking.entryCount > 0,
    true,
    "First pass must contain ranking entries."
  );

  assert.equal(
    result.rankingSaveResult.saved,
    true,
    "First ranking snapshot must be saved."
  );

  assert.equal(
    result.suspiciousEmptyRanking,
    false,
    "First pass must not be suspicious."
  );

  const savedRanking =
    storage.readRanking(
      result.eventRecord.eventKey
    );

  assert.ok(
    savedRanking,
    "Ranking JSON was not saved."
  );

  assert.equal(
    savedRanking.rankingHash,
    result.ranking.rankingHash,
    "Saved rankingHash does not match."
  );

  assert.equal(
    savedRanking.entryCount,
    result.ranking.entryCount,
    "Saved ranking entryCount does not match."
  );

  printPass(
    "Normal ranking was saved."
  );
}

function verifySecondPass({
  storage,
  database,
  firstResult,
  secondResult,
  rankingJsonBefore,
  snapshotCountBefore,
  rankingEntryCountBefore,
  liverCountBefore
}) {
  const eventKey =
    firstResult.eventRecord.eventKey;

  assert.equal(
    secondResult.ranking.entryCount,
    0,
    "Second pass must parse zero ranking entries."
  );

  assert.equal(
    secondResult
      .hasPreviousNonEmptyRanking,
    true,
    "Previous non-empty ranking must be detected."
  );

  assert.equal(
    secondResult
      .suspiciousEmptyRanking,
    true,
    "Empty ranking must be marked as suspicious."
  );

  assert.equal(
    secondResult
      .rankingSaveResult
      .saved,
    false,
    "Suspicious empty ranking must not create a snapshot."
  );

  assert.equal(
    secondResult
      .rankingSaveResult
      .reason,
    "suspicious-empty-ranking",
    "Unexpected ranking save reason."
  );

  assert.equal(
    secondResult.savedJsonSnapshot,
    false,
    "Suspicious empty ranking must not create Snapshot JSON."
  );

  assert.equal(
    secondResult.savedLivers,
    0,
    "Suspicious empty ranking must not update livers."
  );

  assert.equal(
    secondResult.uniqueLivers,
    0,
    "Suspicious empty ranking must not process livers."
  );

  const rankingJsonAfter =
    storage.readRanking(
      eventKey
    );

  assert.deepEqual(
    rankingJsonAfter,
    rankingJsonBefore,
    "Existing ranking JSON was changed."
  );

  const snapshotCountAfter =
    getSnapshotCount(
      database,
      eventKey
    );

  assert.equal(
    snapshotCountAfter,
    snapshotCountBefore,
    "Snapshot count changed after suspicious empty ranking."
  );

  const rankingEntryCountAfter =
    getRankingEntryCount(
      database,
      eventKey
    );

  assert.equal(
    rankingEntryCountAfter,
    rankingEntryCountBefore,
    "Ranking entry count changed after suspicious empty ranking."
  );

  const liverCountAfter =
    getLiverCount(
      database
    );

  assert.equal(
    liverCountAfter,
    liverCountBefore,
    "Liver count changed after suspicious empty ranking."
  );

  assert.equal(
    getTableCount(
      database,
      "snapshots"
    ),
    1,
    "Expected exactly one snapshot after both passes."
  );

  assert.equal(
    getTableCount(
      database,
      "ranking_entries"
    ),
    firstResult.ranking.entryCount,
    "Expected ranking_entries to remain unchanged."
  );

  printPass(
    "Suspicious empty ranking was blocked."
  );

  printPass(
    "Existing ranking JSON was preserved."
  );

  printPass(
    "Snapshot count was preserved."
  );

  printPass(
    "Ranking entries were preserved."
  );

  printPass(
    "Liver data was preserved."
  );
}

function main() {
  printHeader(
    "MixArchive ranking Fail Safe test"
  );

  console.log(
    "This test does not modify production JSON or production SQLite."
  );

  console.log("");

  const sourceStorage =
    new Storage({
      baseDir:
        SOURCE_DATA_DIR,

      enableBackup:
        false
    });

  const source =
    findUsableSourceSample(
      sourceStorage
    );

  assert.ok(
    source,
    "No usable page-cache sample with ranking entries was found."
  );

  console.log(
    `Selected eventKey: ${source.event.eventKey}`
  );

  console.log(
    `Title: ${source.event.title}`
  );

  console.log(
    `Source ranking entries: ${source.ranking.entryCount}`
  );

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

  let success = false;

  try {
    printHeader(
      "1. Normal ranking save"
    );

    const firstResult =
      updateService.updateEvent({
        eventRecord:
          source.event,

        pageContent:
          source.pageContent,

        scheduledAt:
          null,

        status:
          "success",

        startedAtMs:
          Date.now()
      });

    verifyFirstPass({
      storage,
      database,
      result:
        firstResult
    });

    console.log("");

    console.log(
      `rankingHash: ${firstResult.ranking.rankingHash}`
    );

    console.log(
      `entries: ${firstResult.ranking.entryCount}`
    );

    const rankingJsonBefore =
      storage.readRanking(
        source.event.eventKey
      );

    const snapshotCountBefore =
      getSnapshotCount(
        database,
        source.event.eventKey
      );

    const rankingEntryCountBefore =
      getRankingEntryCount(
        database,
        source.event.eventKey
      );

    const liverCountBefore =
      getLiverCount(
        database
      );

    printHeader(
      "2. Simulate empty ranking parse"
    );

    const emptyRankingPageContent =
      createEmptyRankingPageContent(
        source.pageContent
      );

    const emptyRanking =
      RankingService.fetch({
        pageContent:
          emptyRankingPageContent,

        event:
          source.event
      });

    assert.equal(
      emptyRanking.entryCount,
      0,
      "Test setup failed: ranking did not parse as zero entries."
    );

    console.log(
      "Simulated ranking entries: 0"
    );

    const secondResult =
      updateService.updateEvent({
        eventRecord:
          source.event,

        pageContent:
          emptyRankingPageContent,

        scheduledAt:
          null,

        status:
          "success",

        startedAtMs:
          Date.now()
      });

    verifySecondPass({
      storage,
      database,
      firstResult,
      secondResult,
      rankingJsonBefore,
      snapshotCountBefore,
      rankingEntryCountBefore,
      liverCountBefore
    });

    printHeader(
      "Test summary"
    );

    console.log(
      `eventKey: ${source.event.eventKey}`
    );

    console.log(
      `originalRankingEntries: ${firstResult.ranking.entryCount}`
    );

    console.log(
      `simulatedRankingEntries: ${secondResult.ranking.entryCount}`
    );

    console.log(
      `protectionReason: ${secondResult.rankingSaveResult.reason}`
    );

    console.log("");

    console.log(
      "All ranking Fail Safe tests passed."
    );

    success = true;
  } finally {
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

try {
  main();
} catch (error) {
  console.error("");

  console.error(
    "Ranking Fail Safe test failed."
  );

  console.error("");

  console.error(error);

  process.exit(1);
}