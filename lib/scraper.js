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

    const allEvents = await page.$$eval(
      "a.thumb[href*='/live/event/']",
      (links) => {
        const seen = new Set();

        return links
          .map((link) => {
            const href = link.getAttribute("href") || "";

            const url = href.startsWith("http")
              ? href
              : `https://mixch.tv${href}`;

            const eventIdMatch = url.match(/\/live\/event\/(\d+)/);

            if (!eventIdMatch) {
              return null;
            }

            if (seen.has(url)) {
              return null;
            }

            seen.add(url);

            const img = link.querySelector("img");

            return {
              eventId: eventIdMatch[1],
              title: img?.getAttribute("alt")?.trim() || "",
              eventUrl: url,
              bannerImageUrl: img?.getAttribute("src") || null,
              phase: url.includes("/recruiting")
                ? "recruiting"
                : "active"
            };
          })
          .filter(Boolean);
      }
    );

    const summary = {
      total: allEvents.length,
      active: allEvents.filter(e => e.phase === "active").length,
      recruiting: allEvents.filter(e => e.phase === "recruiting").length
    };

    console.log("Event link summary:", summary);

    const events = allEvents.filter(e => e.phase === "active");

    return {
      url: EVENTS_URL,
      events,
      fetchedAt: new Date().toISOString()
    };

  } finally {
    await browser.close();
  }
}