import { chromium } from "playwright";
import { fetchEvents } from "../lib/scraper.js";
import { EventPageService } from "../lib/eventPageService.js";

async function main() {
  console.log("Fetching event list...");

  const result = await fetchEvents();
  const event = result.events?.[0];

  if (!event) {
    throw new Error("No active event found.");
  }

  console.log("Target event:");
  console.log({
    eventId: event.eventId,
    title: event.title,
    eventUrl: event.eventUrl
  });
  console.log("");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("Opening event page...");

    const pageCache = await EventPageService.open({
      page,
      event
    });

    console.log("Event page period result:");
    console.log({
      eventId: pageCache.eventId,
      title: pageCache.title,
      eventUrl: pageCache.eventUrl,
      openedUrl: pageCache.openedUrl,
      startAt: pageCache.startAt,
      endAt: pageCache.endAt,
      tabs: pageCache.tabs,
      hasDetailHtml: Boolean(pageCache.detailHtml),
      hasRankingHtml: Boolean(pageCache.rankingHtml)
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});