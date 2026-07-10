import {
  updateEventRecord
} from "./eventService.js";

import {
  EventDetailService
} from "./eventDetailService.js";

import {
  RankingService
} from "./rankingService.js";

import {
  updateLiverRecord
} from "./liverService.js";

export class ArchiveUpdateService {
  constructor({
    storage,
    database
  }) {
    if (!storage) {
      throw new Error(
        "ArchiveUpdateService: storage is required."
      );
    }

    if (!database) {
      throw new Error(
        "ArchiveUpdateService: database is required."
      );
    }

    this.storage = storage;
    this.database = database;
  }

  hasPreviousNonEmptyRanking(
    eventKey
  ) {
    if (!eventKey) {
      return false;
    }

    const row =
      this.database.db
        .prepare(`
          SELECT
            1 AS found

          FROM snapshots s

          INNER JOIN ranking_entries re
            ON re.snapshot_id =
              s.snapshot_id

          WHERE
            s.event_key = ?

          LIMIT 1
        `)
        .get(eventKey);

    return Boolean(row);
  }

  updateEvent({
    eventRecord,
    pageContent,
    detailWithoutEventKey = null,
    scheduledAt = null,
    status = "success",
    startedAtMs = null
  }) {
    if (!eventRecord?.eventKey) {
      throw new Error(
        "ArchiveUpdateService.updateEvent: eventRecord.eventKey is required."
      );
    }

    if (!pageContent) {
      throw new Error(
        "ArchiveUpdateService.updateEvent: pageContent is required."
      );
    }

    const existingEvent =
      this.storage.readEvent(
        eventRecord.eventKey
      );

    const eventBeforeSnapshot =
      updateEventRecord(
        existingEvent,
        eventRecord,
        null
      );

    const parsedDetail =
      detailWithoutEventKey ||
      EventDetailService.fetch({
        pageContent,
        event: eventRecord
      });

    const detail = {
      ...parsedDetail,

      eventKey:
        eventRecord.eventKey
    };

    const pageCache = {
      ...pageContent,

      eventKey:
        eventRecord.eventKey,

      startAt:
        detail.startAt,

      endAt:
        detail.endAt
    };

    const ranking =
      RankingService.fetch({
        pageContent,
        event: eventRecord
      });

    const hasPreviousNonEmptyRanking =
      this.hasPreviousNonEmptyRanking(
        eventRecord.eventKey
      );

    const suspiciousEmptyRanking =
      ranking.entryCount === 0 &&
      hasPreviousNonEmptyRanking;

    //
    // JSON First
    //

    this.storage.saveEvent(
      eventBeforeSnapshot
    );

    this.storage.saveEventDetail(
      detail
    );

    const jsonDetailHistoryResult =
      this.storage.saveEventDetailHistory(
        detail
      );

    this.storage.savePageCache(
      pageCache
    );

    //
    // Fail Safe:
    //
    // 過去に1件以上のランキング実績があるイベントが
    // 突然0件になった場合は、
    // ranking JSONを上書きしない。
    //

    if (!suspiciousEmptyRanking) {
      this.storage.saveRanking(
        ranking
      );
    }

    //
    // SQLite basic data
    //

    this.database.upsertEvent(
      eventBeforeSnapshot
    );

    this.database.upsertEventDetail({
      ...detail,

      capturedAt:
        detail.detailCapturedAt
    });

    const sqliteDetailHistoryResult =
      this.database.saveEventDetailHistory({
        ...detail,

        capturedAt:
          detail.detailCapturedAt
      });

    this.database.upsertPageCache(
      pageCache
    );

    //
    // Liver
    //

    const processedLiverIds =
      new Set();

    let savedLivers = 0;

    if (!suspiciousEmptyRanking) {
      for (
        const rankingEntry of
        ranking.entries
      ) {
        if (!rankingEntry.profileId) {
          continue;
        }

        const existingLiver =
          this.storage.readLiver(
            rankingEntry.profileId
          );

        const liver =
          updateLiverRecord({
            existingLiver,

            rankingEntry,

            eventKey:
              eventRecord.eventKey,

            seenAt:
              ranking.capturedAt
          });

        this.storage.saveLiver(
          liver
        );

        this.database.upsertLiver(
          liver,
          ranking.capturedAt
        );

        savedLivers += 1;

        processedLiverIds.add(
          rankingEntry.profileId
        );
      }
    }

    //
    // Duration
    //

    const durationMs =
      Number.isFinite(startedAtMs)
        ? Math.max(
            Date.now() -
              startedAtMs,
            0
          )
        : null;

    //
    // Ranking snapshot
    //

    let rankingSaveResult;

    if (suspiciousEmptyRanking) {
      rankingSaveResult = {
        saved: false,

        reason:
          "suspicious-empty-ranking",

        snapshotId:
          null
      };
    } else {
      rankingSaveResult =
        this.database
          .saveRankingSnapshot({
            eventKey:
              eventRecord.eventKey,

            rankings:
              ranking.entries,

            capturedAt:
              ranking.capturedAt,

            scheduledAt,

            durationMs,

            status,

            rankingHash:
              ranking.rankingHash
          });
    }

    let savedJsonSnapshot = false;

    let snapshot = null;

    let eventWithSnapshot =
      eventBeforeSnapshot;

    if (rankingSaveResult.saved) {
      snapshot = {
        snapshotId:
          rankingSaveResult.snapshotId,

        eventKey:
          eventRecord.eventKey,

        eventId:
          eventRecord.eventId,

        capturedAt:
          ranking.capturedAt,

        scheduledAt,

        durationMs,

        status,

        rankingHash:
          ranking.rankingHash,

        entryCount:
          ranking.entryCount,

        entries:
          ranking.entries
      };

      this.storage.saveSnapshot(
        snapshot
      );

      savedJsonSnapshot = true;

      eventWithSnapshot =
        updateEventRecord(
          eventBeforeSnapshot,
          eventRecord,
          rankingSaveResult.snapshotId
        );

      this.storage.saveEvent(
        eventWithSnapshot
      );
    }

    return {
      eventRecord,

      eventBeforeSnapshot,

      eventWithSnapshot,

      detail,

      pageCache,

      ranking,

      snapshot,

      durationMs,

      hasPreviousNonEmptyRanking,

      suspiciousEmptyRanking,

      jsonDetailHistoryResult,

      sqliteDetailHistoryResult,

      rankingSaveResult,

      savedJsonSnapshot,

      savedLivers,

      uniqueLivers:
        processedLiverIds.size
    };
  }
}