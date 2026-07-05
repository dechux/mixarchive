import { chromium } from "playwright";

import { loadConfig } from "./lib/config.js";
import { Logger } from "./lib/logger.js";
import { Storage } from "./lib/storage.js";
import { toJstIsoString } from "./lib/datetime.js";
import { fetchEvents } from "./lib/scraper.js";
import { EventDetailService } from "./lib/eventDetailService.js";
import { createEventRecord } from "./lib/eventService.js";

const logger = new Logger("MixArchive");

async function main() {
  logger.info("MixArchive starting...");

  const config = loadConfig();
  logger.info("Config loaded.");

  const storage = new Storage({
    baseDir: "data",
    backupDir: "data/backups",
    enableBackup: config.storage?.backup ?? true
  });

  logger.info("Storage initialized.");
  logger.info(`Current JST time: ${toJstIsoString()}`);

  logger.info("Fetching MixChannel events...");

  const result = await fetchEvents({
    headless: config.scraping?.headless ?? true,
    timeoutMs: 60000,
    waitMs: 5000
  });

  logger.info(`Fetched: ${result.url}`);
  logger.info(`Parsed events: ${result.events.length}`);

  const detailLimit = config.scraping?.detailLimit ?? 5;
  const detailTargets = result.events.slice(0, detailLimit);

  logger.info(`Fetching event details: ${detailTargets.length}`);

  const browser = await chromium.launch({
    headless: config.scraping?.headless ?? true
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1400,
        height: 1200
      }
    });

    for (const eventSummary of detailTargets) {
      try {
        logger.info(
          `Fetching detail: ${eventSummary.eventId} / ${eventSummary.title}`
        );

        await page.goto(eventSummary.eventUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000
        });

        await page.waitForTimeout(5000);

        const detail = await EventDetailService.fetch({
          page,
          event: eventSummary
        });

        const event = createEventRecord({
          eventId: eventSummary.eventId,
          title: eventSummary.title,
          eventUrl: eventSummary.eventUrl,
          startAt: detail.startAt,
          endAt: detail.endAt,
          status: "unknown"
        });

        storage.saveEvent(event);

        detail.eventKey = event.eventKey;

        const existingDetail = storage.readEventDetail(event.eventKey);

        const unchanged =
          existingDetail &&
          existingDetail.detailHash === detail.detailHash &&
          existingDetail.startAt === detail.startAt &&
          existingDetail.endAt === detail.endAt;

        if (unchanged) {
          logger.info(`Detail unchanged: ${event.eventKey}`);
          continue;
        }

        storage.saveEventDetail(detail);

        logger.success(`Saved event/detail: ${event.eventKey}`);
      } catch (error) {
        logger.error(
          `Failed event/detail: ${eventSummary.eventId} / ${eventSummary.title}`,
          error
        );
      }
    }
  } finally {
    await browser.close();
  }

  logger.success("Event scraping completed.");
  logger.finish();
}

main().catch((error) => {
  logger.error("MixArchive failed.", error);
  process.exit(1);
});