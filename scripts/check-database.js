import { MixArchiveDatabase } from "../lib/database.js";

const database = new MixArchiveDatabase();

try {
  const counts = {
    events: database.db
      .prepare("SELECT COUNT(*) AS count FROM events")
      .get().count,

    eventDetails: database.db
      .prepare("SELECT COUNT(*) AS count FROM event_details")
      .get().count,

    pageCache: database.db
      .prepare("SELECT COUNT(*) AS count FROM page_cache")
      .get().count,

    livers: database.db
      .prepare("SELECT COUNT(*) AS count FROM livers")
      .get().count,

    liverNames: database.db
      .prepare("SELECT COUNT(*) AS count FROM liver_names")
      .get().count,

    snapshots: database.db
      .prepare("SELECT COUNT(*) AS count FROM snapshots")
      .get().count,

    rankingEntries: database.db
      .prepare("SELECT COUNT(*) AS count FROM ranking_entries")
      .get().count
  };

  const recentEvents = database.db
    .prepare(`
      SELECT
        event_key,
        event_id,
        title,
        start_at,
        end_at,
        status,
        updated_at
      FROM events
      ORDER BY updated_at DESC
      LIMIT 5
    `)
    .all();

  const recentSnapshots = database.db
    .prepare(`
      SELECT
        snapshot_id,
        event_key,
        captured_at,
        ranking_hash
      FROM snapshots
      ORDER BY captured_at DESC
      LIMIT 5
    `)
    .all();

  console.log("MixArchive SQLite check");
  console.log("");

  console.log("Counts:");
  console.log(counts);
  console.log("");

  console.log("Recent events:");
  console.log(recentEvents);
  console.log("");

  console.log("Recent snapshots:");
  console.log(recentSnapshots);
  console.log("");

  if (recentEvents.length > 0) {
    const sampleEventKey = recentEvents[0].event_key;

    const participants = database.getEventParticipants(sampleEventKey);

    console.log(`Event participants sample: ${sampleEventKey}`);
    console.log(participants.slice(0, 10));
    console.log("");
  }

  const sampleLiver = database.db
    .prepare(`
      SELECT
        profile_id,
        current_name
      FROM livers
      ORDER BY last_seen_at DESC
      LIMIT 1
    `)
    .get();

  if (sampleLiver) {
    const history = database.getLiverHistory(sampleLiver.profile_id);

    console.log(
      `Liver history sample: ${sampleLiver.profile_id} / ${sampleLiver.current_name}`
    );
    console.log(history.slice(0, 10));
    console.log("");
  }

  console.log("Database check completed.");
} catch (error) {
  console.error("Database check failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  database.close();
}