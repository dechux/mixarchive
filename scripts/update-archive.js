import { chromium } from "playwright";

import {
  fetchEvents
} from "../lib/scraper.js";

import {
  createEventRecord
} from "../lib/eventService.js";

import {
  EventPageService
} from "../lib/eventPageService.js";

import {
  EventDetailService
} from "../lib/eventDetailService.js";

import {
  Storage
} from "../lib/storage.js";

import {
  MixArchiveDatabase
} from "../lib/database.js";

import {
  ArchiveUpdateService
} from "../lib/archiveUpdateService.js";

function parseArgs(argv) {
  const options = {
    limit: null,
    waitMs: 5000,
    headless: true
  };

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const value = Number(
        arg.replace(
          "--limit=",
          ""
        )
      );

      if (
        Number.isFinite(value) &&
        value > 0
      ) {
        options.limit =
          Math.floor(value);
      }

      continue;
    }

    if (arg.startsWith("--wait-ms=")) {
      const value = Number(
        arg.replace(
          "--wait-ms=",
          ""
        )
      );

      if (
        Number.isFinite(value) &&
        value >= 0
      ) {
        options.waitMs =
          Math.floor(value);
      }

      continue;
    }

    if (arg === "--headed") {
      options.headless = false;
    }
  }

  return options;
}

async function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  console.log(
    "MixArchive update started."
  );

  console.log("");

  console.log("Options:");

  console.log({
    limit:
      options.limit,

    waitMs:
      options.waitMs,

    headless:
      options.headless
  });

  console.log("");

  const storage =
    new Storage();

  const database =
    new MixArchiveDatabase();

  const updateService =
    new ArchiveUpdateService({
      storage,
      database
    });

  const browser =
    await chromium.launch({
      headless:
        options.headless
    });

  const page =
    await browser.newPage();

  const summary = {
    fetchedEvents: 0,
    targetEvents: 0,

    savedEvents: 0,
    savedDetails: 0,
    savedPageCaches: 0,

    savedDetailHistoryJson: 0,
    savedDetailHistorySqlite: 0,

    duplicateDetailHistoryJson: 0,
    duplicateDetailHistorySqlite: 0,

    parsedRankings: 0,
    parsedRankingEntries: 0,

    savedRankingSnapshots: 0,
    savedRankingEntries: 0,

    duplicateRankings: 0,

    suspiciousEmptyRankings: 0,

    savedLivers: 0,
    uniqueLivers: 0,

    savedJsonSnapshots: 0,

    totalDurationMs: 0,

    skippedEvents: 0,
    failedEvents: 0
  };

  const skippedEvents = [];

  const failedEvents = [];

  const suspiciousEmptyRankingEvents =
    [];

  const processedLiverIds =
    new Set();

  try {
    console.log(
      "Fetching active events..."
    );

    const result =
      await fetchEvents();

    const rawEvents =
      result.events || [];

    summary.fetchedEvents =
      rawEvents.length;

    const targetEvents =
      options.limit
        ? rawEvents.slice(
            0,
            options.limit
          )
        : rawEvents;

    summary.targetEvents =
      targetEvents.length;

    console.log(
      `Fetched active events: ${rawEvents.length}`
    );

    console.log(
      `Target events: ${targetEvents.length}`
    );

    console.log("");

    for (
      const rawEvent of
      targetEvents
    ) {
      const startedAtMs =
        Date.now();

      try {
        console.log(
          `Opening event ${rawEvent.eventId}: ` +
          `${rawEvent.title}`
        );

        const pageContent =
          await EventPageService.open({
            page,

            event:
              rawEvent,

            waitMs:
              options.waitMs
          });

        const detailWithoutEventKey =
          EventDetailService.fetch({
            pageContent,
            event: rawEvent
          });

        if (
          !detailWithoutEventKey.startAt ||
          !detailWithoutEventKey.endAt
        ) {
          summary.skippedEvents += 1;

          skippedEvents.push({
            eventId:
              rawEvent.eventId,

            title:
              rawEvent.title,

            eventUrl:
              rawEvent.eventUrl,

            reason:
              "startAt/endAt is missing"
          });

          console.log(
            "  skipped: startAt/endAt is missing"
          );

          continue;
        }

        const eventRecord =
          createEventRecord({
            eventId:
              rawEvent.eventId,

            title:
              rawEvent.title,

            eventUrl:
              rawEvent.eventUrl,

            startAt:
              detailWithoutEventKey.startAt,

            endAt:
              detailWithoutEventKey.endAt,

            status:
              "active",

            detectedAt:
              result.fetchedAt
          });

        const updateResult =
          updateService.updateEvent({
            eventRecord,

            pageContent,

            detailWithoutEventKey,

            scheduledAt:
              null,

            status:
              "success",

            startedAtMs
          });

        summary.savedEvents += 1;

        summary.savedDetails += 1;

        summary.savedPageCaches += 1;

        summary.parsedRankings += 1;

        summary.parsedRankingEntries +=
          updateResult
            .ranking
            .entryCount;

        summary.savedLivers +=
          updateResult.savedLivers;

        if (
          Number.isFinite(
            updateResult.durationMs
          )
        ) {
          summary.totalDurationMs +=
            updateResult.durationMs;
        }

        for (
          const rankingEntry of
          updateResult.ranking.entries
        ) {
          if (rankingEntry.profileId) {
            processedLiverIds.add(
              rankingEntry.profileId
            );
          }
        }

        if (
          updateResult
            .jsonDetailHistoryResult
            .saved
        ) {
          summary
            .savedDetailHistoryJson +=
            1;
        } else {
          summary
            .duplicateDetailHistoryJson +=
            1;
        }

        if (
          updateResult
            .sqliteDetailHistoryResult
            .saved
        ) {
          summary
            .savedDetailHistorySqlite +=
            1;
        } else {
          summary
            .duplicateDetailHistorySqlite +=
            1;
        }

        if (
          updateResult
            .rankingSaveResult
            .saved
        ) {
          summary
            .savedRankingSnapshots +=
            1;

          summary
            .savedRankingEntries +=
            updateResult
              .ranking
              .entryCount;
        } else if (
          updateResult
            .rankingSaveResult
            .reason ===
          "suspicious-empty-ranking"
        ) {
          summary
            .suspiciousEmptyRankings +=
            1;

          suspiciousEmptyRankingEvents.push({
            eventKey:
              eventRecord.eventKey,

            eventId:
              eventRecord.eventId,

            title:
              eventRecord.title,

            eventUrl:
              eventRecord.eventUrl,

            reason:
              "previous non-empty ranking exists, but current ranking parsed as zero entries"
          });
        } else {
          summary
            .duplicateRankings +=
            1;
        }

        if (
          updateResult
            .savedJsonSnapshot
        ) {
          summary
            .savedJsonSnapshots +=
            1;
        }

        if (
          updateResult
            .suspiciousEmptyRanking
        ) {
          console.warn(
            `  protected: ${eventRecord.eventKey} / ` +
            "current ranking parsed as 0 entries / " +
            "previous ranking preserved"
          );
        } else if (
          updateResult
            .rankingSaveResult
            .saved
        ) {
          console.log(
            `  saved: ${eventRecord.eventKey} / ` +
            `ranking entries: ${updateResult.ranking.entryCount} / ` +
            `duration: ${updateResult.durationMs}ms`
          );
        } else {
          console.log(
            `  saved: ${eventRecord.eventKey} / ` +
            "ranking unchanged / " +
            `duration: ${updateResult.durationMs}ms`
          );
        }
      } catch (error) {
        summary.failedEvents += 1;

        failedEvents.push({
          eventId:
            rawEvent.eventId,

          title:
            rawEvent.title,

          eventUrl:
            rawEvent.eventUrl,

          error:
            error.message
        });

        console.error(
          `  failed: ${rawEvent.eventId}`
        );

        console.error(
          `  ${error.message}`
        );
      }
    }
  } finally {
    summary.uniqueLivers =
      processedLiverIds.size;

    await browser.close();

    database.close();
  }

  const averageDurationMs =
    summary.savedEvents > 0
      ? Math.round(
          summary.totalDurationMs /
          summary.savedEvents
        )
      : 0;

  console.log("");

  console.log(
    "MixArchive update summary:"
  );

  console.log({
    ...summary,
    averageDurationMs
  });

  if (
    suspiciousEmptyRankingEvents.length >
    0
  ) {
    console.log("");

    console.log(
      "Suspicious empty ranking events:"
    );

    for (
      const event of
      suspiciousEmptyRankingEvents.slice(
        0,
        10
      )
    ) {
      console.log(event);
    }
  }

  if (
    skippedEvents.length > 0
  ) {
    console.log("");

    console.log(
      "Skipped event samples:"
    );

    for (
      const skippedEvent of
      skippedEvents.slice(0, 5)
    ) {
      console.log(
        skippedEvent
      );
    }
  }

  if (
    failedEvents.length > 0
  ) {
    console.log("");

    console.log(
      "Failed event samples:"
    );

    for (
      const failedEvent of
      failedEvents.slice(0, 5)
    ) {
      console.log(
        failedEvent
      );
    }
  }

  console.log("");

  console.log(
    "MixArchive update finished."
  );
}

main().catch((error) => {
  console.error(
    "MixArchive update failed."
  );

  console.error(error);

  process.exit(1);
});