import { loadConfig } from "./lib/config.js";
import { Logger } from "./lib/logger.js";
import { Storage } from "./lib/storage.js";
import { toJstIsoString } from "./lib/datetime.js";
import { fetchEventsPage } from "./lib/scraper.js";

const logger = new Logger("MixArchive");

async function main() {
  logger.info("MixArchive starting...");

  // 設定読み込み
  const config = loadConfig();
  logger.info("Config loaded.");

  // ストレージ初期化
  const storage = new Storage({
    baseDir: "data",
    backupDir: "data/backups",
    enableBackup: config.storage?.backup ?? true
  });

  logger.info("Storage initialized.");
  logger.info(`Current JST time: ${toJstIsoString()}`);

  // イベント一覧ページ取得
  logger.info("Fetching MixChannel events page...");

  const page = await fetchEventsPage({
    headless: config.scraping?.headless ?? true,
    timeoutMs: 60000,
    waitMs: 5000
  });

  logger.info(`Fetched: ${page.url}`);
  logger.info(`HTML Length: ${page.html.length.toLocaleString()} bytes`);

  logger.success("Initial scraping completed.");
  logger.finish();
}

main().catch((error) => {
  logger.error("MixArchive failed.", error);
  process.exit(1);
});