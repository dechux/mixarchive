import { chromium } from "playwright";

const EVENTS_URL = "https://mixch.tv/live/events";

export async function fetchEventsPage({
  headless = true,
  timeoutMs = 60000,
  waitMs = 5000
} = {}) {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();

  try {
    await page.goto(EVENTS_URL, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });

    await page.waitForTimeout(waitMs);

    const html = await page.content();

    return {
      url: EVENTS_URL,
      html,
      fetchedAt: new Date().toISOString()
    };
  } finally {
    await browser.close();
  }
}