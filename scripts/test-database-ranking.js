import { MixArchiveDatabase } from "../lib/database.js";

const database = new MixArchiveDatabase();

try {
  const capturedAt = new Date().toISOString();

  const event = {
    eventKey: "test_ranking_20260706_20260712",
    eventId: "test_ranking",
    title: "SQLiteランキング保存テストイベント",
    eventUrl: "https://mixch.tv/p/test-ranking",
    startAt: "2026-07-06T00:00:00.000Z",
    endAt: "2026-07-12T23:59:59.000Z",
    status: "active"
  };

  const rankings = [
    {
      rank: 1,
      profileId: "test-profile-001",
      profileUrl: "https://mixch.tv/u/test-profile-001",
      name: "テストライバーA",
      point: "123,456",
      iconUrl: "https://example.com/icon-a.jpg"
    },
    {
      rank: 2,
      profileId: "test-profile-002",
      profileUrl: "https://mixch.tv/u/test-profile-002",
      name: "テストライバーB",
      point: "98,765",
      iconUrl: "https://example.com/icon-b.jpg"
    },
    {
      rank: 3,
      profileId: "test-profile-003",
      profileUrl: "https://mixch.tv/u/test-profile-003",
      name: "テストライバーC",
      point: 54321,
      iconUrl: "https://example.com/icon-c.jpg"
    }
  ];

  database.upsertEvent(event);

  const snapshotId = database.saveRankingSnapshot({
    eventKey: event.eventKey,
    rankings,
    capturedAt,
    scheduledAt: "2026-07-08T13:30:00.000Z",
    durationMs: 1234,
    status: "success",
    rankingHash: "test-ranking-hash"
  });

  const savedSnapshot = database.db
    .prepare(`
      SELECT *
      FROM snapshots
      WHERE snapshot_id = ?
    `)
    .get(snapshotId);

  const savedRankingEntries = database.db
    .prepare(`
      SELECT
        re.snapshot_id,
        re.profile_id,
        l.current_name,
        re.rank,
        re.point
      FROM ranking_entries re
      INNER JOIN livers l
        ON l.profile_id = re.profile_id
      WHERE re.snapshot_id = ?
      ORDER BY re.rank ASC
    `)
    .all(snapshotId);

  const eventParticipants = database.getEventParticipants(event.eventKey);
  const liverHistory = database.getLiverHistory("test-profile-001");

  console.log("SQLite ranking save test completed.");
  console.log("");

  console.log("Snapshot:");
  console.log(savedSnapshot);
  console.log("");

  console.log("RankingEntries:");
  console.log(savedRankingEntries);
  console.log("");

  console.log("EventParticipants:");
  console.log(eventParticipants);
  console.log("");

  console.log("LiverHistory:");
  console.log(liverHistory);
} catch (error) {
  console.error("SQLite ranking save test failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  database.close();
}