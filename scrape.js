import { chromium } from "playwright";

import { loadConfig } from "./lib/config.js";
import { Logger } from "./lib/logger.js";
import { Storage } from "./lib/storage.js";
import { toJstIsoString } from "./lib/datetime.js";
import { fetchEvents } from "./lib/scraper.js";
import { createEventRecord, updateEventRecord } from "./lib/eventService.js";
import { EventPageService } from "./lib/eventPageService.js";
import { EventDetailService } from "./lib/eventDetailService.js";
import { RankingService } from "./lib/rankingService.js";

const logger = new Logger("MixArchive");

async function main() {
  logger.info("MixArchive starting...");

  const config = loadConfig();
  logger.info("Config loaded.");

  const storage = new Storage({
    baseDir: "data/current",
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

  const browser = await chromium.launch({
    headless: config.scraping?.headless ?? true
  });

  const page = await browser.newPage();

  try {
    const targetEvents = result.events.slice(0, 5);

    logger.info(`Processing events: ${targetEvents.length}`);

    for (const rawEvent of targetEvents) {
      logger.info(`Processing event: ${rawEvent.eventId} / ${rawEvent.title}`);

      const tempEvent = createEventRecord({
        eventId: rawEvent.eventId,
        title: rawEvent.title,
        eventUrl: rawEvent.eventUrl,
        startAt: rawEvent.startAt,
        endAt: rawEvent.endAt,
        status: rawEvent.phase || "active"
      });

      const pageCache = await EventPageService.open({
        page,
        event: tempEvent
      });

      const detail = EventDetailService.fetch({
        pageContent: pageCache,
        event: tempEvent
      });

      const event = createEventRecord({
        eventId: rawEvent.eventId,
        title: rawEvent.title || detail.title,
        eventUrl: rawEvent.eventUrl,
        startAt: detail.startAt || rawEvent.startAt,
        endAt: detail.endAt || rawEvent.endAt,
        status: rawEvent.phase || "active"
      });

      const existingEvent = storage.readEvent(event.eventKey);
      const updatedEvent = updateEventRecord(existingEvent, event);

      storage.saveEvent(updatedEvent);
      logger.success(`Saved event: ${updatedEvent.eventKey}`);

      const pageCacheForSave = {
        ...pageCache,
        eventKey: updatedEvent.eventKey,
        eventId: updatedEvent.eventId,
        eventUrl: updatedEvent.eventUrl,
        title: updatedEvent.title
      };

      storage.savePageCache(pageCacheForSave);
      logger.success(`Saved page cache: ${updatedEvent.eventKey}`);

      const detailForSave = {
        ...detail,
        eventKey: updatedEvent.eventKey,
        startAt: updatedEvent.startAt,
        endAt: updatedEvent.endAt
      };

      const existingDetail = storage.readEventDetail(updatedEvent.eventKey);

      if (existingDetail?.detailHash === detailForSave.detailHash) {
        logger.info(`Detail unchanged: ${updatedEvent.eventKey}`);
      } else {
        storage.saveEventDetail(detailForSave);
        logger.success(`Saved detail: ${updatedEvent.eventKey}`);
      }

      const ranking = RankingService.fetch({
        pageContent: pageCacheForSave,
        event: updatedEvent
      });

      const existingRanking = storage.readRanking(updatedEvent.eventKey);

      if (existingRanking?.rankingHash === ranking.rankingHash) {
        logger.info(`Ranking unchanged: ${updatedEvent.eventKey}`);
      } else {
        storage.saveRanking(ranking);
        logger.success(
          `Saved ranking: ${updatedEvent.eventKey} / entries: ${ranking.entryCount}`
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