import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  Storage
} from "../lib/storage.js";

import {
  EventDetailService
} from "../lib/eventDetailService.js";

import {
  RankingService
} from "../lib/rankingService.js";

import {
  updateEventRecord
} from "../lib/eventService.js";

import {
  updateLiverRecord
} from "../lib/liverService.js";

const PAGE_CACHE_DIR =
  "data/current/page-cache";

function parseArgs(argv) {
  const options = {
    limit: 5
  };

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const value = Number(
        arg.replace("--limit=", "")
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

function printPass(message) {
  console.log(
    `PASS: ${message}`
  );
}

function printSkip(message) {
  console.log(
    `SKIP: ${message}`
  );
}

function getPageCacheEventKeys() {
  if (
    !fs.existsSync(
      PAGE_CACHE_DIR
    )
  ) {
    return [];
  }

  return fs
    .readdirSync(
      PAGE_CACHE_DIR
    )
    .filter(fileName =>
      fileName.endsWith(".json")
    )
    .map(fileName =>
      fileName.replace(
        /\.json$/i,
        ""
      )
    )
    .sort();
}

function getUsableSamples({
  storage,
  limit
}) {
  const eventKeys =
    getPageCacheEventKeys();

  const samples = [];

  for (const eventKey of eventKeys) {
    const event =
      storage.readEvent(
        eventKey
      );

    const pageContent =
      storage.readPageCache(
        eventKey
      );

    if (
      !event ||
      !pageContent
    ) {
      continue;
    }

    if (!event.eventKey) {
      continue;
    }

    if (!event.eventId) {
      continue;
    }

    if (!event.eventUrl) {
      continue;
    }

    samples.push({
      event,
      pageContent
    });

    if (
      samples.length >= limit
    ) {
      break;
    }
  }

  return samples;
}

function assertUniqueProfileIds(
  entries
) {
  const profileIds = entries
    .map(entry =>
      entry.profileId
    )
    .filter(Boolean);

  const uniqueProfileIds =
    new Set(profileIds);

  assert.equal(
    uniqueProfileIds.size,
    profileIds.length,
    "Ranking contains duplicate profileIds."
  );
}

function testEventDetailPipeline({
  event,
  pageContent
}) {
  const first =
    EventDetailService.fetch({
      pageContent,
      event
    });

  const second =
    EventDetailService.fetch({
      pageContent,
      event
    });

  assert.equal(
    first.eventKey,
    event.eventKey,
    "EventDetail eventKey does not match."
  );

  assert.ok(
    first.detailHash,
    "EventDetail detailHash is missing."
  );

  assert.ok(
    Array.isArray(
      first.sections
    ),
    "EventDetail sections must be an array."
  );

  assert.ok(
    first.startAt,
    "EventDetail startAt is missing."
  );

  assert.ok(
    first.endAt,
    "EventDetail endAt is missing."
  );

  assert.equal(
    first.detailHash,
    second.detailHash,
    "Same page content produced different detailHash values."
  );

  assert.deepEqual(
    first.sections,
    second.sections,
    "Same page content produced different sections."
  );

  return first;
}

function testRankingPipeline({
  event,
  pageContent
}) {
  const first =
    RankingService.fetch({
      pageContent,
      event
    });

  const second =
    RankingService.fetch({
      pageContent,
      event
    });

  assert.equal(
    first.eventKey,
    event.eventKey,
    "Ranking eventKey does not match."
  );

  assert.ok(
    first.rankingHash,
    "Ranking rankingHash is missing."
  );

  assert.ok(
    Array.isArray(
      first.entries
    ),
    "Ranking entries must be an array."
  );

  assert.equal(
    first.entryCount,
    first.entries.length,
    "Ranking entryCount does not match entries.length."
  );

  assert.equal(
    first.rankingHash,
    second.rankingHash,
    "Same page content produced different rankingHash values."
  );

  assert.deepEqual(
    first.entries,
    second.entries,
    "Same page content produced different ranking entries."
  );

  assertUniqueProfileIds(
    first.entries
  );

  for (const entry of first.entries) {
    assert.ok(
      entry.profileId,
      "Ranking entry profileId is missing."
    );

    assert.ok(
      entry.profileUrl,
      "Ranking entry profileUrl is missing."
    );
  }

  return first;
}

function testEventUpdateDuplicateSafe(
  event
) {
  const snapshotId =
    "test-snapshot-id";

  const first =
    updateEventRecord(
      event,
      event,
      snapshotId
    );

  const second =
    updateEventRecord(
      first,
      event,
      snapshotId
    );

  assert.ok(
    Array.isArray(
      second.snapshots
    ),
    "Event snapshots must be an array."
  );

  const matchingSnapshots =
    second.snapshots.filter(
      id => id === snapshotId
    );

  assert.equal(
    matchingSnapshots.length,
    1,
    "Duplicate snapshotId was added to event."
  );
}

function testLiverUpdateDuplicateSafe({
  rankingEntry,
  eventKey
}) {
  const seenAt =
    "2026-07-10T00:00:00.000Z";

  const first =
    updateLiverRecord({
      existingLiver: null,
      rankingEntry,
      eventKey,
      seenAt
    });

  const second =
    updateLiverRecord({
      existingLiver: first,
      rankingEntry,
      eventKey,
      seenAt
    });

  assert.equal(
    second.profileId,
    rankingEntry.profileId,
    "Liver profileId does not match."
  );

  const matchingEventKeys =
    second.eventKeys.filter(
      key => key === eventKey
    );

  assert.equal(
    matchingEventKeys.length,
    1,
    "Duplicate eventKey was added to liver."
  );

  if (rankingEntry.name) {
    const matchingNames =
      second.nameHistory.filter(
        item =>
          item.name ===
          rankingEntry.name
      );

    assert.equal(
      matchingNames.length,
      1,
      "Duplicate name history was added to liver."
    );
  }
}

function testSample({
  event,
  pageContent,
  index
}) {
  console.log(
    `Sample ${index}`
  );

  console.log(
    `  eventKey: ${event.eventKey}`
  );

  console.log(
    `  title: ${event.title || "(no title)"}`
  );

  const detail =
    testEventDetailPipeline({
      event,
      pageContent
    });

  printPass(
    "EventDetail pipeline"
  );

  console.log(
    `  sections: ${detail.sections.length}`
  );

  console.log(
    `  detailHash: ${detail.detailHash}`
  );

  const ranking =
    testRankingPipeline({
      event,
      pageContent
    });

  printPass(
    "Ranking pipeline"
  );

  console.log(
    `  entries: ${ranking.entryCount}`
  );

  console.log(
    `  rankingHash: ${ranking.rankingHash}`
  );

  testEventUpdateDuplicateSafe(
    event
  );

  printPass(
    "Event snapshot Duplicate Safe"
  );

  if (ranking.entries.length > 0) {
    testLiverUpdateDuplicateSafe({
      rankingEntry:
        ranking.entries[0],

      eventKey:
        event.eventKey
    });

    printPass(
      "Liver Duplicate Safe"
    );
  } else {
    printSkip(
      "Liver Duplicate Safe: ranking has no entries."
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
    "MixArchive update pipeline smoke test"
  );

  console.log(
    `Sample limit: ${options.limit}`
  );

  console.log("");

  const storage =
    new Storage({
      enableBackup: false
    });

  const samples =
    getUsableSamples({
      storage,
      limit: options.limit
    });

  assert.ok(
    samples.length > 0,
    "No usable page-cache samples found."
  );

  console.log(
    `Usable samples: ${samples.length}`
  );

  console.log("");

  for (
    let index = 0;
    index < samples.length;
    index += 1
  ) {
    testSample({
      ...samples[index],
      index: index + 1
    });
  }

  printHeader(
    "Test summary"
  );

  console.log(
    `Tested samples: ${samples.length}`
  );

  console.log("");

  console.log(
    "All update pipeline smoke tests passed."
  );
}

try {
  main();
} catch (error) {
  console.error("");

  console.error(
    "Update pipeline smoke test failed."
  );

  console.error("");

  console.error(error);

  process.exit(1);
}