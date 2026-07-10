import assert from "node:assert/strict";

import {
  MixArchiveDatabase
} from "../lib/database.js";

import {
  ArchiveQueryService
} from "../lib/archiveQueryService.js";

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

function getSampleEvent(database) {
  return database.db
    .prepare(`
      SELECT
        event_key,
        event_id,
        title,
        event_url,
        start_at,
        end_at,
        status
      FROM events
      WHERE title IS NOT NULL
        AND TRIM(title) <> ''
        AND event_key NOT LIKE 'test_%'
      ORDER BY
        start_at DESC,
        event_key DESC
      LIMIT 1
    `)
    .get() || null;
}

function getSampleRankingEvent(
  database
) {
  return database.db
    .prepare(`
      SELECT DISTINCT
        e.event_key,
        e.title
      FROM events e

      INNER JOIN snapshots s
        ON s.event_key =
          e.event_key

      INNER JOIN ranking_entries re
        ON re.snapshot_id =
          s.snapshot_id

      WHERE
        e.event_key NOT LIKE 'test_%'

      ORDER BY
        s.captured_at DESC

      LIMIT 1
    `)
    .get() || null;
}

function getSampleLiver(database) {
  return database.db
    .prepare(`
      SELECT
        l.profile_id,
        l.current_name,
        l.profile_url
      FROM livers l

      INNER JOIN ranking_entries re
        ON re.profile_id =
          l.profile_id

      WHERE
        l.profile_id NOT LIKE
          'test-profile-%'

        AND l.current_name IS NOT NULL

        AND TRIM(l.current_name) <> ''

      ORDER BY
        l.last_seen_at DESC,
        l.profile_id ASC

      LIMIT 1
    `)
    .get() || null;
}

function getSampleEventDetail(
  database
) {
  return database.db
    .prepare(`
      SELECT
        ed.event_key,
        ed.detail_hash,
        ed.captured_at,

        e.title

      FROM event_details ed

      INNER JOIN events e
        ON e.event_key =
          ed.event_key

      WHERE
        ed.event_key NOT LIKE 'test_%'

      ORDER BY
        ed.captured_at DESC

      LIMIT 1
    `)
    .get() || null;
}

function getSampleEventDetailHistory(
  database
) {
  return database.db
    .prepare(`
      SELECT
        edh.event_key,
        COUNT(*) AS history_count,

        e.title

      FROM event_detail_history edh

      INNER JOIN events e
        ON e.event_key =
          edh.event_key

      WHERE
        edh.event_key NOT LIKE 'test_%'

      GROUP BY
        edh.event_key,
        e.title

      ORDER BY
        history_count DESC,
        edh.event_key ASC

      LIMIT 1
    `)
    .get() || null;
}

function testEventNameSearch({
  queryService,
  sampleEvent
}) {
  assert.ok(
    sampleEvent,
    "Sample event is required."
  );

  const matches =
    queryService.searchEventsByName(
      sampleEvent.title
    );

  assert.ok(
    Array.isArray(matches),
    "searchEventsByName must return an array."
  );

  assert.ok(
    matches.length > 0,
    "Event name search returned no matches."
  );

  const found =
    matches.some(
      event =>
        event.eventKey ===
        sampleEvent.event_key
    );

  assert.equal(
    found,
    true,
    "Expected event was not found by title."
  );

  printPass(
    "Event name search"
  );

  console.log(
    `  title: ${sampleEvent.title}`
  );

  console.log(
    `  eventKey: ${sampleEvent.event_key}`
  );
}

function testEventRecord({
  queryService,
  sampleEvent
}) {
  const event =
    queryService.getEventRecord(
      sampleEvent.event_key
    );

  assert.ok(
    event,
    "getEventRecord returned null."
  );

  assert.equal(
    event.event_key,
    sampleEvent.event_key,
    "Event key does not match."
  );

  printPass(
    "Event record lookup"
  );
}

function testEventParticipants({
  queryService,
  sampleRankingEvent
}) {
  if (!sampleRankingEvent) {
    printSkip(
      "Event participant history: no ranking event found."
    );

    return;
  }

  const participants =
    queryService
      .getEventParticipantHistory(
        sampleRankingEvent.event_key
      );

  assert.ok(
    Array.isArray(participants),
    "getEventParticipantHistory must return an array."
  );

  assert.ok(
    participants.length > 0,
    "Ranking event has no participants."
  );

  for (const participant of participants) {
    assert.ok(
      participant.profileId,
      "Participant profileId is missing."
    );

    assert.ok(
      participant.snapshotCount > 0,
      "Participant snapshotCount must be greater than zero."
    );
  }

  printPass(
    "Event participant history"
  );

  console.log(
    `  eventKey: ${sampleRankingEvent.event_key}`
  );

  console.log(
    `  participants: ${participants.length}`
  );
}

function testLatestRanking({
  queryService,
  sampleRankingEvent
}) {
  if (!sampleRankingEvent) {
    printSkip(
      "Latest ranking: no ranking event found."
    );

    return;
  }

  const ranking =
    queryService
      .getLatestEventRanking(
        sampleRankingEvent.event_key
      );

  assert.ok(
    ranking,
    "getLatestEventRanking returned no result."
  );

  assert.ok(
    ranking.snapshot,
    "Latest ranking snapshot is missing."
  );

  assert.ok(
    Array.isArray(ranking.entries),
    "Ranking entries must be an array."
  );

  assert.ok(
    ranking.entries.length > 0,
    "Latest ranking contains no entries."
  );

  printPass(
    "Latest event ranking"
  );

  console.log(
    `  snapshotId: ${ranking.snapshot.snapshotId}`
  );

  console.log(
    `  entries: ${ranking.entries.length}`
  );
}

function testLiverNameSearch({
  queryService,
  sampleLiver
}) {
  if (!sampleLiver) {
    printSkip(
      "Liver name search: no liver found."
    );

    return;
  }

  const matches =
    queryService.searchLiversByName(
      sampleLiver.current_name
    );

  assert.ok(
    Array.isArray(matches),
    "searchLiversByName must return an array."
  );

  assert.ok(
    matches.length > 0,
    "Liver name search returned no matches."
  );

  const found =
    matches.some(
      liver =>
        liver.profileId ===
        sampleLiver.profile_id
    );

  assert.equal(
    found,
    true,
    "Expected liver was not found by name."
  );

  printPass(
    "Liver name search"
  );

  console.log(
    `  name: ${sampleLiver.current_name}`
  );

  console.log(
    `  profileId: ${sampleLiver.profile_id}`
  );
}

function testLiverEventHistory({
  queryService,
  sampleLiver
}) {
  if (!sampleLiver) {
    printSkip(
      "Liver event history: no liver found."
    );

    return;
  }

  const history =
    queryService.getLiverEventHistory(
      sampleLiver.profile_id
    );

  assert.ok(
    Array.isArray(history),
    "getLiverEventHistory must return an array."
  );

  assert.ok(
    history.length > 0,
    "Liver event history is empty."
  );

  for (const event of history) {
    assert.ok(
      event.eventKey,
      "Liver history eventKey is missing."
    );

    assert.ok(
      event.snapshotCount > 0,
      "Liver history snapshotCount must be greater than zero."
    );
  }

  printPass(
    "Liver event history"
  );

  console.log(
    `  events: ${history.length}`
  );
}

function testLiverTimeline({
  queryService,
  sampleLiver
}) {
  if (!sampleLiver) {
    printSkip(
      "Liver timeline: no liver found."
    );

    return;
  }

  const timeline =
    queryService.getLiverTimeline(
      sampleLiver.profile_id
    );

  assert.ok(
    Array.isArray(timeline),
    "getLiverTimeline must return an array."
  );

  assert.ok(
    timeline.length > 0,
    "Liver timeline is empty."
  );

  for (const item of timeline) {
    assert.ok(
      item.eventKey,
      "Timeline eventKey is missing."
    );

    assert.ok(
      item.capturedAt,
      "Timeline capturedAt is missing."
    );
  }

  printPass(
    "Liver ranking timeline"
  );

  console.log(
    `  snapshots: ${timeline.length}`
  );
}

function testEventDetail({
  queryService,
  sampleDetail
}) {
  if (!sampleDetail) {
    printSkip(
      "Event detail: no event detail found."
    );

    return;
  }

  const detail =
    queryService.getEventDetailRecord(
      sampleDetail.event_key
    );

  assert.ok(
    detail,
    "getEventDetailRecord returned null."
  );

  assert.equal(
    detail.event_key,
    sampleDetail.event_key,
    "Event detail key does not match."
  );

  const sections =
    queryService.normalizeEventSections(
      detail
    );

  assert.ok(
    Array.isArray(sections),
    "normalizeEventSections must return an array."
  );

  printPass(
    "Event detail lookup"
  );

  console.log(
    `  eventKey: ${sampleDetail.event_key}`
  );

  console.log(
    `  sections: ${sections.length}`
  );
}

function testEventDetailHistory({
  queryService,
  sampleDetailHistory
}) {
  if (!sampleDetailHistory) {
    printSkip(
      "Event detail history: no history found."
    );

    return;
  }

  const history =
    queryService.getEventDetailHistory(
      sampleDetailHistory.event_key
    );

  assert.ok(
    Array.isArray(history),
    "getEventDetailHistory must return an array."
  );

  assert.ok(
    history.length > 0,
    "Event detail history is empty."
  );

  assert.equal(
    history.length,
    sampleDetailHistory.history_count,
    "Event detail history count does not match SQLite."
  );

  printPass(
    "Event detail history"
  );

  console.log(
    `  eventKey: ${sampleDetailHistory.event_key}`
  );

  console.log(
    `  historyCount: ${history.length}`
  );
}

function testEventDetailDiff({
  queryService,
  sampleDetailHistory
}) {
  if (!sampleDetailHistory) {
    printSkip(
      "Event detail diff: no history found."
    );

    return;
  }

  const result =
    queryService.getEventDetailDiff(
      sampleDetailHistory.event_key
    );

  assert.ok(
    result,
    "getEventDetailDiff returned no result."
  );

  assert.ok(
    result.event,
    "Event detail diff event is missing."
  );

  assert.equal(
    result.historyCount,
    sampleDetailHistory.history_count,
    "Detail diff history count does not match."
  );

  assert.ok(
    Array.isArray(result.changes),
    "Detail diff changes must be an array."
  );

  const expectedChangeCount =
    Math.max(
      result.historyCount - 1,
      0
    );

  assert.equal(
    result.changes.length,
    expectedChangeCount,
    "Detail diff change count is incorrect."
  );

  for (const change of result.changes) {
    assert.ok(
      change.diff,
      "Detail diff result is missing."
    );

    assert.ok(
      Array.isArray(
        change.diff.added
      ),
      "Added sections must be an array."
    );

    assert.ok(
      Array.isArray(
        change.diff.changed
      ),
      "Changed sections must be an array."
    );

    assert.ok(
      Array.isArray(
        change.diff.removed
      ),
      "Removed sections must be an array."
    );

    assert.ok(
      Array.isArray(
        change.diff.unchanged
      ),
      "Unchanged sections must be an array."
    );
  }

  printPass(
    "Event detail diff"
  );

  console.log(
    `  historyCount: ${result.historyCount}`
  );

  console.log(
    `  changes: ${result.changes.length}`
  );
}

function main() {
  printHeader(
    "ArchiveQueryService smoke test"
  );

  const database =
    new MixArchiveDatabase();

  const queryService =
    new ArchiveQueryService(
      database
    );

  try {
    const sampleEvent =
      getSampleEvent(database);

    const sampleRankingEvent =
      getSampleRankingEvent(
        database
      );

    const sampleLiver =
      getSampleLiver(database);

    const sampleDetail =
      getSampleEventDetail(
        database
      );

    const sampleDetailHistory =
      getSampleEventDetailHistory(
        database
      );

    assert.ok(
      sampleEvent,
      "No usable event found in database."
    );

    testEventNameSearch({
      queryService,
      sampleEvent
    });

    testEventRecord({
      queryService,
      sampleEvent
    });

    testEventParticipants({
      queryService,
      sampleRankingEvent
    });

    testLatestRanking({
      queryService,
      sampleRankingEvent
    });

    testLiverNameSearch({
      queryService,
      sampleLiver
    });

    testLiverEventHistory({
      queryService,
      sampleLiver
    });

    testLiverTimeline({
      queryService,
      sampleLiver
    });

    testEventDetail({
      queryService,
      sampleDetail
    });

    testEventDetailHistory({
      queryService,
      sampleDetailHistory
    });

    testEventDetailDiff({
      queryService,
      sampleDetailHistory
    });

    printHeader(
      "Test summary"
    );

    console.log(
      "All ArchiveQueryService smoke tests passed."
    );
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error("");

  console.error(
    "ArchiveQueryService smoke test failed."
  );

  console.error("");

  console.error(error);

  process.exit(1);
}