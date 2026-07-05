import { chromium } from "playwright";
import { EventDetailService } from "../lib/eventDetailService.js";

const EVENT_URL = "https://mixch.tv/live/event/14521/recruiting";

async function main() {
  const browser = await chromium.launch({
    headless: false
  });

  const page = await browser.newPage({
    viewport: {
      width: 1400,
      height: 1200
    }
  });

  try {
    console.log("Opening event...");

    await page.goto(EVENT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(10000);

    const event = {
      eventKey: "14521_unknown_unknown",
      eventId: "14521",
      eventUrl: EVENT_URL,
      title: await page.title()
    };

    const detail = await EventDetailService.fetch({
      page,
      event
    });

    console.log("\n================ EventDetail ================");
    console.log(JSON.stringify(detail, null, 2));

    await page.screenshot({
      path: "logs/event-detail-debug.png",
      fullPage: true
    });

    console.log("\nScreenshot saved: logs/event-detail-debug.png");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);