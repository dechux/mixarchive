import { chromium } from "playwright";

const EVENTS_URL = "https://mixch.tv/live/events";

export async function fetchEvents({
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

    const events = await page.$$eval("a.thumb[href*='/live/event/']", (links) => {
      const seen = new Set();

      return links
        .map((link) => {
          const href = link.getAttribute("href") || "";
          const url = href.startsWith("http")
            ? href
            : `https://mixch.tv${href}`;

          const eventIdMatch = url.match(/\/live\/event\/(\d+)/);
          const eventId = eventIdMatch ? eventIdMatch[1] : null;

          const image = link.querySelector("img");
          const title = image?.getAttribute("alt")?.trim() || "";
          const bannerImageUrl = image?.getAttribute("src") || null;

          if (!eventId || seen.has(url)) return null;
          seen.add(url);

          return {
            eventId,
            title,
            eventUrl: url,
            bannerImageUrl
          };
        })
        .filter(Boolean);
    });

    return {
      url: EVENTS_URL,
      events,
      fetchedAt: new Date().toISOString()
    };
  } finally {
    await browser.close();
  }
}