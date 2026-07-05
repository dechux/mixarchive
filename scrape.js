import { loadConfig } from "./lib/config.js";
import { Logger } from "./lib/logger.js";
import { Storage } from "./lib/storage.js";
import { toJstIsoString } from "./lib/datetime.js";
import { fetchEvents } from "./lib/scraper.js";

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

  for (const event of result.events.slice(0, 5)) {
   logger.info(`${event.eventId} / ${event.title} / ${event.eventUrl}`);
  }

  logger.success("Event scraping completed.");
  logger.finish();
}

main().catch((error) => {
  logger.error("MixArchive failed.", error);
  process.exit(1);
});