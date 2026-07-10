export class ArchiveQueryService {
  constructor(database) {
    if (!database?.db) {
      throw new Error(
        "ArchiveQueryService: database is required."
      );
    }

    this.database = database;
  }

  parseJsonValue(
    value,
    fallback
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    if (typeof value === "object") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  getFirstValue(
    object,
    keys,
    fallback = null
  ) {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null
      ) {
        return object[key];
      }
    }

    return fallback;
  }

  normalizeHistoryItem(item) {
    return {
      eventKey:
        item?.eventKey ??
        item?.event_key ??
        "",

      title:
        item?.title ??
        "",

      rank:
        item?.rank ??
        null,

      point:
        item?.point ??
        item?.points ??
        null,

      capturedAt:
        item?.capturedAt ??
        item?.captured_at ??
        ""
    };
  }

  normalizeSectionText(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  normalizeEventSections(detail) {
    if (!detail) {
      return [];
    }

    const sectionsValue =
      this.getFirstValue(
        detail,
        [
          "sections_json",
          "sections"
        ],
        []
      );

    const sections =
      this.parseJsonValue(
        sectionsValue,
        []
      );

    if (!Array.isArray(sections)) {
      return [];
    }

    return sections
      .map((section, index) => ({
        label:
          section?.label ||
          section?.normalizedLabel ||
          `SECTION ${index + 1}`,

        normalizedLabel:
          section?.normalizedLabel ||
          section?.label ||
          "",

        text:
          section?.text ||
          "",

        order:
          Number.isFinite(
            section?.order
          )
            ? section.order
            : index
      }))
      .sort((a, b) =>
        a.order - b.order
      );
  }

  normalizeEventTabs(detail) {
    if (!detail) {
      return [];
    }

    const tabsValue =
      this.getFirstValue(
        detail,
        [
          "tabs_json",
          "tabs"
        ],
        []
      );

    const tabs =
      this.parseJsonValue(
        tabsValue,
        []
      );

    return Array.isArray(tabs)
      ? tabs
      : [];
  }

  normalizeSectionsForDiff(
    sectionsValue
  ) {
    const sections =
      this.parseJsonValue(
        sectionsValue,
        []
      );

    if (!Array.isArray(sections)) {
      return [];
    }

    const labelCounts =
      new Map();

    return sections.map(
      (section, index) => {
        const label =
          section?.label ||
          section?.normalizedLabel ||
          `SECTION ${index + 1}`;

        const currentCount =
          labelCounts.get(label) || 0;

        const occurrence =
          currentCount + 1;

        labelCounts.set(
          label,
          occurrence
        );

        return {
          key:
            `${label}::${occurrence}`,

          label,

          occurrence,

          order:
            Number.isFinite(
              section?.order
            )
              ? section.order
              : index,

          text:
            this.normalizeSectionText(
              section?.text || ""
            )
        };
      }
    );
  }

  compareEventDetailSections(
    previousSections,
    currentSections
  ) {
    const previousMap =
      new Map(
        previousSections.map(
          section => [
            section.key,
            section
          ]
        )
      );

    const currentMap =
      new Map(
        currentSections.map(
          section => [
            section.key,
            section
          ]
        )
      );

    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];

    for (
      const currentSection of
      currentSections
    ) {
      const previousSection =
        previousMap.get(
          currentSection.key
        );

      if (!previousSection) {
        added.push(
          currentSection
        );

        continue;
      }

      if (
        previousSection.text !==
        currentSection.text
      ) {
        changed.push({
          key:
            currentSection.key,

          label:
            currentSection.label,

          occurrence:
            currentSection.occurrence,

          previousText:
            previousSection.text,

          currentText:
            currentSection.text
        });

        continue;
      }

      unchanged.push(
        currentSection
      );
    }

    for (
      const previousSection of
      previousSections
    ) {
      if (
        !currentMap.has(
          previousSection.key
        )
      ) {
        removed.push(
          previousSection
        );
      }
    }

    return {
      added,
      removed,
      changed,
      unchanged
    };
  }

  groupHistoryByEvent(history) {
    const groups =
      new Map();

    for (const rawItem of history) {
      const item =
        this.normalizeHistoryItem(
          rawItem
        );

      if (!item.eventKey) {
        continue;
      }

      if (
        !groups.has(item.eventKey)
      ) {
        groups.set(
          item.eventKey,
          {
            eventKey:
              item.eventKey,

            title:
              item.title,

            snapshots: []
          }
        );
      }

      groups
        .get(item.eventKey)
        .snapshots.push(item);
    }

    const result = [];

    for (
      const group of
      groups.values()
    ) {
      const snapshots =
        [...group.snapshots]
          .sort((a, b) => {
            const timeA =
              a.capturedAt || "";

            const timeB =
              b.capturedAt || "";

            return timeA.localeCompare(
              timeB
            );
          });

      const first =
        snapshots[0];

      const latest =
        snapshots[
          snapshots.length - 1
        ];

      const ranks =
        snapshots
          .map(item => item.rank)
          .filter(rank =>
            Number.isFinite(rank)
          );

      const points =
        snapshots
          .map(item => item.point)
          .filter(point =>
            Number.isFinite(point)
          );

      result.push({
        eventKey:
          group.eventKey,

        title:
          group.title ||
          first?.title ||
          latest?.title ||
          "",

        firstRank:
          first?.rank ?? null,

        latestRank:
          latest?.rank ?? null,

        bestRank:
          ranks.length > 0
            ? Math.min(...ranks)
            : null,

        firstPoint:
          first?.point ?? null,

        latestPoint:
          latest?.point ?? null,

        maxPoint:
          points.length > 0
            ? Math.max(...points)
            : null,

        firstCapturedAt:
          first?.capturedAt || "",

        latestCapturedAt:
          latest?.capturedAt || "",

        snapshotCount:
          snapshots.length
      });
    }

    return result.sort((a, b) =>
      b.latestCapturedAt.localeCompare(
        a.latestCapturedAt
      )
    );
  }

  searchEventsByName(eventName) {
    const searchText =
      String(
        eventName || ""
      ).trim();

    if (!searchText) {
      return [];
    }

    const pattern =
      `%${searchText}%`;

    return this.database.db
      .prepare(`
        SELECT
          event_key,
          event_id,
          title,
          event_url,
          start_at,
          end_at,
          status,
          created_at,
          updated_at
        FROM events
        WHERE title LIKE ?
        ORDER BY
          start_at DESC,
          event_key DESC
      `)
      .all(pattern)
      .map(row => ({
        eventKey:
          row.event_key,

        eventId:
          row.event_id,

        title:
          row.title || "",

        eventUrl:
          row.event_url || null,

        startAt:
          row.start_at || null,

        endAt:
          row.end_at || null,

        status:
          row.status || null,

        createdAt:
          row.created_at || null,

        updatedAt:
          row.updated_at || null
      }));
  }

  searchLiversByName(name) {
    const searchText =
      String(
        name || ""
      ).trim();

    if (!searchText) {
      return [];
    }

    const pattern =
      `%${searchText}%`;

    const currentNameRows =
      this.database.db
        .prepare(`
          SELECT
            profile_id,
            current_name,
            profile_url,
            icon_url,
            first_seen_at,
            last_seen_at
          FROM livers
          WHERE current_name LIKE ?
          ORDER BY current_name ASC
        `)
        .all(pattern);

    const historyRows =
      this.database.db
        .prepare(`
          SELECT
            ln.profile_id,
            ln.name,
            ln.first_seen_at,
            ln.last_seen_at,

            l.current_name,
            l.profile_url,
            l.icon_url

          FROM liver_names ln

          LEFT JOIN livers l
            ON l.profile_id =
              ln.profile_id

          WHERE ln.name LIKE ?

          ORDER BY
            ln.name ASC,
            ln.profile_id ASC
        `)
        .all(pattern);

    const matches =
      new Map();

    for (
      const row of
      currentNameRows
    ) {
      const profileId =
        row.profile_id;

      matches.set(
        profileId,
        {
          profileId,

          currentName:
            row.current_name || "",

          profileUrl:
            row.profile_url || null,

          iconUrl:
            row.icon_url || null,

          matchedNames: [
            {
              name:
                row.current_name || "",

              matchedBy:
                "current name",

              firstSeenAt:
                row.first_seen_at ||
                null,

              lastSeenAt:
                row.last_seen_at ||
                null
            }
          ]
        }
      );
    }

    for (
      const row of historyRows
    ) {
      const profileId =
        row.profile_id;

      if (!matches.has(profileId)) {
        matches.set(
          profileId,
          {
            profileId,

            currentName:
              row.current_name || "",

            profileUrl:
              row.profile_url || null,

            iconUrl:
              row.icon_url || null,

            matchedNames: []
          }
        );
      }

      const match =
        matches.get(profileId);

      const duplicate =
        match.matchedNames.some(
          item =>
            item.name === row.name &&
            item.matchedBy ===
              "name history"
        );

      if (!duplicate) {
        match.matchedNames.push({
          name:
            row.name || "",

          matchedBy:
            "name history",

          firstSeenAt:
            row.first_seen_at ||
            null,

          lastSeenAt:
            row.last_seen_at ||
            null
        });
      }
    }

    return Array.from(
      matches.values()
    ).sort((a, b) => {
      const nameA =
        a.currentName || "";

      const nameB =
        b.currentName || "";

      const nameCompare =
        nameA.localeCompare(
          nameB,
          "ja"
        );

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return a.profileId.localeCompare(
        b.profileId
      );
    });
  }

  getEventRecord(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventRecord: eventKey is required."
      );
    }

    return (
      this.database.db
        .prepare(`
          SELECT *
          FROM events
          WHERE event_key = ?
          LIMIT 1
        `)
        .get(eventKey) ||
      null
    );
  }

  getEventDetailRecord(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventDetailRecord: eventKey is required."
      );
    }

    return (
      this.database.db
        .prepare(`
          SELECT *
          FROM event_details
          WHERE event_key = ?
          LIMIT 1
        `)
        .get(eventKey) ||
      null
    );
  }

  getEventSnapshotCount(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventSnapshotCount: eventKey is required."
      );
    }

    const row =
      this.database.db
        .prepare(`
          SELECT
            COUNT(*) AS count
          FROM snapshots
          WHERE event_key = ?
        `)
        .get(eventKey);

    return row?.count ?? 0;
  }

  getLatestEventRanking(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getLatestEventRanking: eventKey is required."
      );
    }

    const latestSnapshot =
      this.database.db
        .prepare(`
          SELECT
            snapshot_id,
            event_key,
            captured_at,
            scheduled_at,
            status,
            ranking_hash
          FROM snapshots
          WHERE event_key = ?
          ORDER BY
            captured_at DESC
          LIMIT 1
        `)
        .get(eventKey);

    if (!latestSnapshot) {
      return {
        snapshot: null,
        entries: []
      };
    }

    const entries =
      this.database.db
        .prepare(`
          SELECT
            re.rank,
            re.point,
            re.profile_id,

            l.current_name,
            l.profile_url,
            l.icon_url

          FROM ranking_entries re

          LEFT JOIN livers l
            ON l.profile_id =
              re.profile_id

          WHERE re.snapshot_id = ?

          ORDER BY
            re.rank ASC,
            re.profile_id ASC
        `)
        .all(
          latestSnapshot.snapshot_id
        )
        .map(row => ({
          rank:
            row.rank ?? null,

          point:
            row.point ?? null,

          profileId:
            row.profile_id,

          currentName:
            row.current_name || "",

          profileUrl:
            row.profile_url || null,

          iconUrl:
            row.icon_url || null
        }));

    return {
      snapshot: {
        snapshotId:
          latestSnapshot.snapshot_id,

        eventKey:
          latestSnapshot.event_key,

        capturedAt:
          latestSnapshot.captured_at ||
          null,

        scheduledAt:
          latestSnapshot.scheduled_at ||
          null,

        status:
          latestSnapshot.status ||
          null,

        rankingHash:
          latestSnapshot.ranking_hash ||
          null
      },

      entries
    };
  }

  getEventParticipantHistory(
    eventKey
  ) {
    if (!eventKey) {
      throw new Error(
        "getEventParticipantHistory: eventKey is required."
      );
    }

    const rows =
      this.database.db
        .prepare(`
          SELECT
            s.snapshot_id,
            s.event_key,
            s.captured_at,
            s.ranking_hash,

            re.profile_id,
            re.rank,
            re.point,

            l.current_name,
            l.profile_url,
            l.icon_url

          FROM snapshots s

          INNER JOIN ranking_entries re
            ON re.snapshot_id =
              s.snapshot_id

          LEFT JOIN livers l
            ON l.profile_id =
              re.profile_id

          WHERE s.event_key = ?

          ORDER BY
            s.captured_at ASC,
            re.rank ASC
        `)
        .all(eventKey);

    const participants =
      new Map();

    for (const row of rows) {
      const profileId =
        row.profile_id;

      if (!profileId) {
        continue;
      }

      if (
        !participants.has(profileId)
      ) {
        participants.set(
          profileId,
          {
            profileId,

            currentName:
              row.current_name || "",

            profileUrl:
              row.profile_url || null,

            iconUrl:
              row.icon_url || null,

            snapshots: [],

            seenSnapshotKeys:
              new Set()
          }
        );
      }

      const participant =
        participants.get(profileId);

      const snapshotKey =
        row.ranking_hash
          ? `hash:${row.ranking_hash}`
          : `snapshot:${row.snapshot_id}`;

      if (
        participant
          .seenSnapshotKeys
          .has(snapshotKey)
      ) {
        continue;
      }

      participant
        .seenSnapshotKeys
        .add(snapshotKey);

      participant.snapshots.push({
        snapshotId:
          row.snapshot_id,

        capturedAt:
          row.captured_at || "",

        rankingHash:
          row.ranking_hash || null,

        rank:
          row.rank ?? null,

        point:
          row.point ?? null
      });
    }

    const result = [];

    for (
      const participant of
      participants.values()
    ) {
      const snapshots =
        participant.snapshots
          .sort((a, b) =>
            a.capturedAt.localeCompare(
              b.capturedAt
            )
          );

      const first =
        snapshots[0];

      const latest =
        snapshots[
          snapshots.length - 1
        ];

      const ranks =
        snapshots
          .map(
            snapshot =>
              snapshot.rank
          )
          .filter(rank =>
            Number.isFinite(rank)
          );

      const points =
        snapshots
          .map(
            snapshot =>
              snapshot.point
          )
          .filter(point =>
            Number.isFinite(point)
          );

      result.push({
        profileId:
          participant.profileId,

        currentName:
          participant.currentName,

        profileUrl:
          participant.profileUrl,

        iconUrl:
          participant.iconUrl,

        firstRank:
          first?.rank ?? null,

        latestRank:
          latest?.rank ?? null,

        bestRank:
          ranks.length > 0
            ? Math.min(...ranks)
            : null,

        firstPoint:
          first?.point ?? null,

        latestPoint:
          latest?.point ?? null,

        maxPoint:
          points.length > 0
            ? Math.max(...points)
            : null,

        firstCapturedAt:
          first?.capturedAt || "",

        latestCapturedAt:
          latest?.capturedAt || "",

        snapshotCount:
          snapshots.length
      });
    }

    return result.sort((a, b) => {
      const rankA =
        Number.isFinite(
          a.latestRank
        )
          ? a.latestRank
          : Number.MAX_SAFE_INTEGER;

      const rankB =
        Number.isFinite(
          b.latestRank
        )
          ? b.latestRank
          : Number.MAX_SAFE_INTEGER;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.profileId.localeCompare(
        b.profileId
      );
    });
  }

  getLiverEventHistory(profileId) {
    if (!profileId) {
      throw new Error(
        "getLiverEventHistory: profileId is required."
      );
    }

    const history =
      this.database.getLiverHistory(
        profileId
      );

    if (!Array.isArray(history)) {
      return [];
    }

    return this.groupHistoryByEvent(
      history
    );
  }

  getLiverTimeline(profileId) {
    if (!profileId) {
      throw new Error(
        "getLiverTimeline: profileId is required."
      );
    }

    const history =
      this.database.getLiverHistory(
        profileId
      );

    if (!Array.isArray(history)) {
      return [];
    }

    return history.map(
      item =>
        this.normalizeHistoryItem(
          item
        )
    );
  }

  getEventDetailHistory(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventDetailHistory: eventKey is required."
      );
    }

    const history =
      this.database.getEventDetailHistory(
        eventKey
      );

    return Array.isArray(history)
      ? history
      : [];
  }

  getEventDetailDiff(eventKey) {
    if (!eventKey) {
      throw new Error(
        "getEventDetailDiff: eventKey is required."
      );
    }

    const event =
      this.getEventRecord(
        eventKey
      );

    const history =
      this.getEventDetailHistory(
        eventKey
      );

    const changes = [];

    for (
      let index = 1;
      index < history.length;
      index += 1
    ) {
      const previous =
        history[index - 1];

      const current =
        history[index];

      const previousSections =
        this.normalizeSectionsForDiff(
          previous.sections_json
        );

      const currentSections =
        this.normalizeSectionsForDiff(
          current.sections_json
        );

      const diff =
        this.compareEventDetailSections(
          previousSections,
          currentSections
        );

      changes.push({
        index,

        previous: {
          capturedAt:
            previous.captured_at || null,

          detailHash:
            previous.detail_hash || null
        },

        current: {
          capturedAt:
            current.captured_at || null,

          detailHash:
            current.detail_hash || null
        },

        diff
      });
    }

    return {
      event,
      historyCount:
        history.length,
      changes
    };
  }

  getSlowEvents(limit = 10) {
    const normalizedLimit =
      Number.isFinite(limit) &&
      limit > 0
        ? Math.floor(limit)
        : 10;

    return this.database.db
      .prepare(`
        SELECT
          e.event_key,
          e.event_id,
          e.title,
          e.event_url,
          e.start_at,
          e.end_at,
          e.status,

          COUNT(*) AS measurement_count,

          ROUND(
            AVG(s.duration_ms)
          ) AS average_duration_ms,

          MIN(
            s.duration_ms
          ) AS min_duration_ms,

          MAX(
            s.duration_ms
          ) AS max_duration_ms,

          MAX(
            s.captured_at
          ) AS latest_captured_at

        FROM snapshots s

        INNER JOIN events e
          ON e.event_key =
            s.event_key

        WHERE
          s.duration_ms IS NOT NULL

          AND s.duration_ms >= 0

          AND e.event_key NOT LIKE
            'test_%'

        GROUP BY
          e.event_key,
          e.event_id,
          e.title,
          e.event_url,
          e.start_at,
          e.end_at,
          e.status

        ORDER BY
          average_duration_ms DESC,
          max_duration_ms DESC,
          e.event_key ASC

        LIMIT ?
      `)
      .all(normalizedLimit)
      .map(row => ({
        eventKey:
          row.event_key,

        eventId:
          row.event_id,

        title:
          row.title || "",

        eventUrl:
          row.event_url || null,

        startAt:
          row.start_at || null,

        endAt:
          row.end_at || null,

        status:
          row.status || null,

        measurementCount:
          row.measurement_count ?? 0,

        averageDurationMs:
          row.average_duration_ms ?? null,

        minDurationMs:
          row.min_duration_ms ?? null,

        maxDurationMs:
          row.max_duration_ms ?? null,

        latestCapturedAt:
          row.latest_captured_at || null
      }));
  }
}