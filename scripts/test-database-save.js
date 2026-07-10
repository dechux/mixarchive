import { MixArchiveDatabase } from "../lib/database.js";

const database = new MixArchiveDatabase();

try {
  const capturedAt = new Date().toISOString();

  const event = {
    eventKey: "test_20260706_20260712",
    eventId: "test",
    title: "SQLite保存テストイベント",
    eventUrl: "https://mixch.tv/p/test",
    startAt: "2026-07-06T00:00:00.000Z",
    endAt: "2026-07-12T23:59:59.000Z",
    status: "active"
  };

  const detail = {
    eventKey: event.eventKey,
    detailHash: "test-detail-hash",
    rawText: "ABOUT\nこれはSQLite保存テスト用のイベント詳細です。",
    sections: [
      {
        label: "ABOUT",
        text: "これはSQLite保存テスト用のイベント詳細です。",
        order: 1
      }
    ],
    capturedAt
  };

  const pageCache = {
    eventKey: event.eventKey,
    detailHtml: "<html><body>test detail html</body></html>",
    rankingHtml: "<html><body>test ranking html</body></html>",
    tabs: ["ABOUT"],
    bannerImageUrl: "https://example.com/banner.jpg",
    ogDescription: "SQLite保存テスト",
    capturedAt
  };

  const liver = {
    profileId: "test-profile-001",
    currentName: "テストライバー",
    profileUrl: "https://mixch.tv/u/test-profile-001",
    iconUrl: "https://example.com/icon.jpg"
  };

  database.upsertEvent(event);
  database.upsertEventDetail(detail);
  database.upsertPageCache(pageCache);
  database.upsertLiver(liver, capturedAt);

  const savedEvent = database.db
    .prepare(`
      SELECT *
      FROM events
      WHERE event_key = ?
    `)
    .get(event.eventKey);

  const savedDetail = database.db
    .prepare(`
      SELECT *
      FROM event_details
      WHERE event_key = ?
    `)
    .get(event.eventKey);

  const savedPageCache = database.db
    .prepare(`
      SELECT *
      FROM page_cache
      WHERE event_key = ?
    `)
    .get(event.eventKey);

  const savedLiver = database.db
    .prepare(`
      SELECT *
      FROM livers
      WHERE profile_id = ?
    `)
    .get(liver.profileId);

  const savedLiverNames = database.db
    .prepare(`
      SELECT *
      FROM liver_names
      WHERE profile_id = ?
      ORDER BY id
    `)
    .all(liver.profileId);

  console.log("SQLite save test completed.");
  console.log("");

  console.log("Event:");
  console.log(savedEvent);
  console.log("");

  console.log("EventDetail:");
  console.log(savedDetail);
  console.log("");

  console.log("PageCache:");
  console.log(savedPageCache);
  console.log("");

  console.log("Liver:");
  console.log(savedLiver);
  console.log("");

  console.log("LiverNames:");
  console.log(savedLiverNames);
} catch (error) {
  console.error("SQLite save test failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  database.close();
}