import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export class MixArchiveDatabase {
  constructor(
    dbPath = "database/mixarchive.db"
  ) {
    this.dbPath = dbPath;

    fs.mkdirSync(
      path.dirname(dbPath),
      {
        recursive: true
      }
    );

    this.db = new Database(dbPath);

    this.db.pragma(
      "journal_mode = WAL"
    );

    this.db.pragma(
      "foreign_keys = ON"
    );

    this.createTables();
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        event_key TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        title TEXT,
        event_url TEXT,
        start_at TEXT,
        end_at TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_event_id
        ON events (event_id);

      CREATE INDEX IF NOT EXISTS idx_events_period
        ON events (start_at, end_at);

      CREATE INDEX IF NOT EXISTS idx_events_status
        ON events (status);


      CREATE TABLE IF NOT EXISTS event_details (
        event_key TEXT PRIMARY KEY,
        detail_hash TEXT,
        raw_text TEXT,
        sections_json TEXT,
        captured_at TEXT,
        created_at TEXT,
        updated_at TEXT,

        FOREIGN KEY(event_key)
          REFERENCES events(event_key)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_event_details_detail_hash
        ON event_details (detail_hash);


      CREATE TABLE IF NOT EXISTS event_detail_history (
        event_key TEXT NOT NULL,
        detail_hash TEXT NOT NULL,
        raw_text TEXT,
        sections_json TEXT,
        captured_at TEXT,
        created_at TEXT,

        PRIMARY KEY (
          event_key,
          detail_hash
        ),

        FOREIGN KEY(event_key)
          REFERENCES events(event_key)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_event_detail_history_event_key
        ON event_detail_history (
          event_key
        );

      CREATE INDEX IF NOT EXISTS idx_event_detail_history_detail_hash
        ON event_detail_history (
          detail_hash
        );

      CREATE INDEX IF NOT EXISTS idx_event_detail_history_captured_at
        ON event_detail_history (
          captured_at
        );


      CREATE TABLE IF NOT EXISTS page_cache (
        event_key TEXT PRIMARY KEY,
        page_json TEXT,
        captured_at TEXT,
        created_at TEXT,
        updated_at TEXT,

        FOREIGN KEY(event_key)
          REFERENCES events(event_key)
          ON DELETE CASCADE
      );


      CREATE TABLE IF NOT EXISTS livers (
        profile_id TEXT PRIMARY KEY,
        current_name TEXT,
        profile_url TEXT,
        icon_url TEXT,
        first_seen_at TEXT,
        last_seen_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_livers_current_name
        ON livers (current_name);


      CREATE TABLE IF NOT EXISTS liver_names (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        first_seen_at TEXT,
        last_seen_at TEXT,

        UNIQUE(profile_id, name),

        FOREIGN KEY(profile_id)
          REFERENCES livers(profile_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_liver_names_profile_id
        ON liver_names (profile_id);

      CREATE INDEX IF NOT EXISTS idx_liver_names_name
        ON liver_names (name);


      CREATE TABLE IF NOT EXISTS snapshots (
        snapshot_id TEXT PRIMARY KEY,
        event_key TEXT NOT NULL,
        captured_at TEXT,
        scheduled_at TEXT,
        duration_ms INTEGER,
        status TEXT,
        ranking_hash TEXT,
        created_at TEXT,

        FOREIGN KEY(event_key)
          REFERENCES events(event_key)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_event_key
        ON snapshots (event_key);

      CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at
        ON snapshots (captured_at);

      CREATE INDEX IF NOT EXISTS idx_snapshots_ranking_hash
        ON snapshots (ranking_hash);


      CREATE TABLE IF NOT EXISTS ranking_entries (
        snapshot_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        rank INTEGER,
        point INTEGER,
        created_at TEXT,

        PRIMARY KEY(
          snapshot_id,
          profile_id
        ),

        FOREIGN KEY(snapshot_id)
          REFERENCES snapshots(snapshot_id)
          ON DELETE CASCADE,

        FOREIGN KEY(profile_id)
          REFERENCES livers(profile_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ranking_entries_profile_id
        ON ranking_entries (profile_id);

      CREATE INDEX IF NOT EXISTS idx_ranking_entries_rank
        ON ranking_entries (rank);
    `);
  }

  getNow() {
    return new Date().toISOString();
  }

  toJson(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    return JSON.stringify(value);
  }

  normalizePoint(point) {
    if (
      point === undefined ||
      point === null
    ) {
      return null;
    }

    if (typeof point === "number") {
      return point;
    }

    const normalized = String(point)
      .replace(/[^\d]/g, "");

    if (!normalized) {
      return null;
    }

    return Number(normalized);
  }

  createSnapshotId(
    eventKey,
    capturedAt
  ) {
    const source =
      `${eventKey}_${capturedAt}`;

    return crypto
      .createHash("sha1")
      .update(source)
      .digest("hex");
  }

  upsertEvent(event) {
    if (!event || !event.eventKey) {
      throw new Error(
        "upsertEvent: event.eventKey is required."
      );
    }

    if (!event.eventId) {
      throw new Error(
        "upsertEvent: event.eventId is required."
      );
    }

    const now = this.getNow();

    const statement = this.db.prepare(`
      INSERT INTO events (
        event_key,
        event_id,
        title,
        event_url,
        start_at,
        end_at,
        status,
        created_at,
        updated_at
      )
      VALUES (
        @eventKey,
        @eventId,
        @title,
        @eventUrl,
        @startAt,
        @endAt,
        @status,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(event_key) DO UPDATE SET
        event_id = excluded.event_id,
        title = excluded.title,
        event_url = excluded.event_url,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    statement.run({
      eventKey: event.eventKey,
      eventId: event.eventId,
      title: event.title ?? null,
      eventUrl:
        event.eventUrl ?? null,
      startAt:
        event.startAt ?? null,
      endAt:
        event.endAt ?? null,
      status:
        event.status ?? null,
      createdAt:
        event.createdAt ?? now,
      updatedAt: now
    });
  }

  upsertEvents(events) {
    if (!Array.isArray(events)) {
      throw new Error(
        "upsertEvents: events must be an array."
      );
    }

    const transaction =
      this.db.transaction((items) => {
        for (const event of items) {
          this.upsertEvent(event);
        }
      });

    transaction(events);
  }

  upsertEventDetail(detail) {
    if (
      !detail ||
      !detail.eventKey
    ) {
      throw new Error(
        "upsertEventDetail: detail.eventKey is required."
      );
    }

    const now = this.getNow();

    const statement = this.db.prepare(`
      INSERT INTO event_details (
        event_key,
        detail_hash,
        raw_text,
        sections_json,
        captured_at,
        created_at,
        updated_at
      )
      VALUES (
        @eventKey,
        @detailHash,
        @rawText,
        @sectionsJson,
        @capturedAt,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(event_key) DO UPDATE SET
        detail_hash =
          excluded.detail_hash,
        raw_text =
          excluded.raw_text,
        sections_json =
          excluded.sections_json,
        captured_at =
          excluded.captured_at,
        updated_at =
          excluded.updated_at
    `);

    statement.run({
      eventKey:
        detail.eventKey,

      detailHash:
        detail.detailHash ?? null,

      rawText:
        detail.rawText ?? null,

      sectionsJson:
        this.toJson(
          detail.sections ?? []
        ),

      capturedAt:
        detail.capturedAt ??
        detail.detailCapturedAt ??
        now,

      createdAt:
        detail.createdAt ?? now,

      updatedAt: now
    });
  }

  getEventDetailHistoryByHash(
    eventKey,
    detailHash
  ) {
    if (!eventKey) {
      throw new Error(
        "getEventDetailHistoryByHash: eventKey is required."
      );
    }

    if (!detailHash) {
      throw new Error(
        "getEventDetailHistoryByHash: detailHash is required."
      );
    }

    return this.db
      .prepare(`
        SELECT
          event_key,
          detail_hash,
          raw_text,
          sections_json,
          captured_at,
          created_at
        FROM event_detail_history
        WHERE event_key = ?
          AND detail_hash = ?
        LIMIT 1
      `)
      .get(
        eventKey,
        detailHash
      );
  }

  saveEventDetailHistory(detail) {
    if (
      !detail ||
      !detail.eventKey
    ) {
      throw new Error(
        "saveEventDetailHistory: detail.eventKey is required."
      );
    }

    if (!detail.detailHash) {
      throw new Error(
        "saveEventDetailHistory: detail.detailHash is required."
      );
    }

    const existing =
      this.getEventDetailHistoryByHash(
        detail.eventKey,
        detail.detailHash
      );

    if (existing) {
      return {
        saved: false,
        reason:
          "duplicate-detail-hash"
      };
    }

    const now = this.getNow();

    const capturedAt =
      detail.capturedAt ??
      detail.detailCapturedAt ??
      now;

    const statement = this.db.prepare(`
      INSERT INTO event_detail_history (
        event_key,
        detail_hash,
        raw_text,
        sections_json,
        captured_at,
        created_at
      )
      VALUES (
        @eventKey,
        @detailHash,
        @rawText,
        @sectionsJson,
        @capturedAt,
        @createdAt
      )
    `);

    statement.run({
      eventKey:
        detail.eventKey,

      detailHash:
        detail.detailHash,

      rawText:
        detail.rawText ?? null,

      sectionsJson:
        this.toJson(
          detail.sections ?? []
        ),

      capturedAt,

      createdAt: now
    });

    return {
      saved: true,
      reason:
        "new-detail-hash"
    };
  }

  getEventDetailHistory(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventDetailHistory: eventKey is required."
      );
    }

    return this.db
      .prepare(`
        SELECT
          event_key,
          detail_hash,
          raw_text,
          sections_json,
          captured_at,
          created_at
        FROM event_detail_history
        WHERE event_key = ?
        ORDER BY captured_at ASC
      `)
      .all(eventKey);
  }

  upsertPageCache(pageCache) {
    if (
      !pageCache ||
      !pageCache.eventKey
    ) {
      throw new Error(
        "upsertPageCache: pageCache.eventKey is required."
      );
    }

    const now = this.getNow();

    const statement = this.db.prepare(`
      INSERT INTO page_cache (
        event_key,
        page_json,
        captured_at,
        created_at,
        updated_at
      )
      VALUES (
        @eventKey,
        @pageJson,
        @capturedAt,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(event_key) DO UPDATE SET
        page_json =
          excluded.page_json,
        captured_at =
          excluded.captured_at,
        updated_at =
          excluded.updated_at
    `);

    statement.run({
      eventKey:
        pageCache.eventKey,

      pageJson:
        this.toJson(pageCache),

      capturedAt:
        pageCache.capturedAt ?? now,

      createdAt:
        pageCache.createdAt ?? now,

      updatedAt: now
    });
  }

  upsertLiver(
    liver,
    seenAt = null
  ) {
    if (
      !liver ||
      !liver.profileId
    ) {
      throw new Error(
        "upsertLiver: liver.profileId is required."
      );
    }

    const now = this.getNow();

    const currentSeenAt =
      seenAt ??
      liver.lastSeenAt ??
      now;

    const currentName =
      liver.currentName ??
      liver.name ??
      null;

    const statement = this.db.prepare(`
      INSERT INTO livers (
        profile_id,
        current_name,
        profile_url,
        icon_url,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
      )
      VALUES (
        @profileId,
        @currentName,
        @profileUrl,
        @iconUrl,
        @firstSeenAt,
        @lastSeenAt,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(profile_id) DO UPDATE SET
        current_name =
          excluded.current_name,
        profile_url =
          COALESCE(
            excluded.profile_url,
            livers.profile_url
          ),
        icon_url =
          COALESCE(
            excluded.icon_url,
            livers.icon_url
          ),
        last_seen_at =
          excluded.last_seen_at,
        updated_at =
          excluded.updated_at
    `);

    statement.run({
      profileId:
        liver.profileId,

      currentName,

      profileUrl:
        liver.profileUrl ?? null,

      iconUrl:
        liver.iconUrl ?? null,

      firstSeenAt:
        liver.firstSeenAt ??
        currentSeenAt,

      lastSeenAt:
        currentSeenAt,

      createdAt:
        liver.createdAt ?? now,

      updatedAt: now
    });

    if (currentName) {
      this.upsertLiverName({
        profileId:
          liver.profileId,

        name:
          currentName,

        seenAt:
          currentSeenAt
      });
    }
  }

  upsertLiverName({
    profileId,
    name,
    seenAt
  }) {
    if (!profileId) {
      throw new Error(
        "upsertLiverName: profileId is required."
      );
    }

    if (!name) {
      throw new Error(
        "upsertLiverName: name is required."
      );
    }

    const currentSeenAt =
      seenAt ?? this.getNow();

    const statement = this.db.prepare(`
      INSERT INTO liver_names (
        profile_id,
        name,
        first_seen_at,
        last_seen_at
      )
      VALUES (
        @profileId,
        @name,
        @firstSeenAt,
        @lastSeenAt
      )
      ON CONFLICT(
        profile_id,
        name
      ) DO UPDATE SET
        last_seen_at =
          excluded.last_seen_at
    `);

    statement.run({
      profileId,
      name,
      firstSeenAt:
        currentSeenAt,
      lastSeenAt:
        currentSeenAt
    });
  }

  getLatestSnapshot(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getLatestSnapshot: eventKey is required."
      );
    }

    return this.db
      .prepare(`
        SELECT
          snapshot_id,
          event_key,
          captured_at,
          scheduled_at,
          duration_ms,
          status,
          ranking_hash,
          created_at
        FROM snapshots
        WHERE event_key = ?
        ORDER BY captured_at DESC
        LIMIT 1
      `)
      .get(eventKey);
  }

  createSnapshot(snapshot) {
    if (
      !snapshot ||
      !snapshot.eventKey
    ) {
      throw new Error(
        "createSnapshot: snapshot.eventKey is required."
      );
    }

    const now = this.getNow();

    const capturedAt =
      snapshot.capturedAt ?? now;

    const snapshotId =
      snapshot.snapshotId ??
      this.createSnapshotId(
        snapshot.eventKey,
        capturedAt
      );

    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO snapshots (
        snapshot_id,
        event_key,
        captured_at,
        scheduled_at,
        duration_ms,
        status,
        ranking_hash,
        created_at
      )
      VALUES (
        @snapshotId,
        @eventKey,
        @capturedAt,
        @scheduledAt,
        @durationMs,
        @status,
        @rankingHash,
        @createdAt
      )
    `);

    statement.run({
      snapshotId,

      eventKey:
        snapshot.eventKey,

      capturedAt,

      scheduledAt:
        snapshot.scheduledAt ?? null,

      durationMs:
        snapshot.durationMs ?? null,

      status:
        snapshot.status ?? null,

      rankingHash:
        snapshot.rankingHash ?? null,

      createdAt: now
    });

    return snapshotId;
  }

  insertRankingEntry(entry) {
    if (
      !entry ||
      !entry.snapshotId
    ) {
      throw new Error(
        "insertRankingEntry: entry.snapshotId is required."
      );
    }

    if (!entry.profileId) {
      throw new Error(
        "insertRankingEntry: entry.profileId is required."
      );
    }

    const now = this.getNow();

    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO ranking_entries (
        snapshot_id,
        profile_id,
        rank,
        point,
        created_at
      )
      VALUES (
        @snapshotId,
        @profileId,
        @rank,
        @point,
        @createdAt
      )
    `);

    statement.run({
      snapshotId:
        entry.snapshotId,

      profileId:
        entry.profileId,

      rank:
        entry.rank ?? null,

      point:
        this.normalizePoint(
          entry.point ??
          entry.points
        ),

      createdAt: now
    });
  }

  saveRankingSnapshot({
    eventKey,
    rankings = [],
    capturedAt = null,
    scheduledAt = null,
    durationMs = null,
    status = "success",
    rankingHash = null
  }) {
    if (!eventKey) {
      throw new Error(
        "saveRankingSnapshot: eventKey is required."
      );
    }

    if (!Array.isArray(rankings)) {
      throw new Error(
        "saveRankingSnapshot: rankings must be an array."
      );
    }

    const latestSnapshot =
      this.getLatestSnapshot(
        eventKey
      );

    if (
      latestSnapshot &&
      latestSnapshot.ranking_hash &&
      rankingHash &&
      latestSnapshot.ranking_hash ===
        rankingHash
    ) {
      return {
        saved: false,

        reason:
          "duplicate-ranking-hash",

        snapshotId:
          latestSnapshot.snapshot_id
      };
    }

    const fixedCapturedAt =
      capturedAt ?? this.getNow();

    const transaction =
      this.db.transaction(() => {
        const snapshotId =
          this.createSnapshot({
            eventKey,

            capturedAt:
              fixedCapturedAt,

            scheduledAt,

            durationMs,

            status,

            rankingHash
          });

        for (const ranking of rankings) {
          if (!ranking.profileId) {
            continue;
          }

          this.upsertLiver(
            {
              profileId:
                ranking.profileId,

              currentName:
                ranking.currentName ??
                ranking.name ??
                null,

              profileUrl:
                ranking.profileUrl ??
                null,

              iconUrl:
                ranking.iconUrl ??
                null
            },
            fixedCapturedAt
          );

          this.insertRankingEntry({
            snapshotId,

            profileId:
              ranking.profileId,

            rank:
              ranking.rank,

            point:
              ranking.point ??
              ranking.points
          });
        }

        return snapshotId;
      });

    const snapshotId =
      transaction();

    return {
      saved: true,

      reason:
        "new-ranking-hash",

      snapshotId
    };
  }

  getEventParticipants(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventParticipants: eventKey is required."
      );
    }

    return this.db
      .prepare(`
        SELECT
          s.event_key,
          s.snapshot_id,
          s.captured_at,
          re.rank,
          re.point,
          l.profile_id,
          l.current_name,
          l.profile_url,
          l.icon_url
        FROM snapshots s
        INNER JOIN ranking_entries re
          ON re.snapshot_id =
            s.snapshot_id
        INNER JOIN livers l
          ON l.profile_id =
            re.profile_id
        WHERE s.event_key = ?
        ORDER BY
          s.captured_at DESC,
          re.rank ASC
      `)
      .all(eventKey);
  }

  getLiverHistory(profileId) {
    if (!profileId) {
      throw new Error(
        "getLiverHistory: profileId is required."
      );
    }

    return this.db
      .prepare(`
        SELECT
          e.event_key,
          e.title,
          e.event_url,
          e.start_at,
          e.end_at,
          s.snapshot_id,
          s.captured_at,
          re.rank,
          re.point
        FROM ranking_entries re
        INNER JOIN snapshots s
          ON s.snapshot_id =
            re.snapshot_id
        INNER JOIN events e
          ON e.event_key =
            s.event_key
        WHERE re.profile_id = ?
        ORDER BY
          s.captured_at DESC
      `)
      .all(profileId);
  }

  close() {
    this.db.close();
  }
}