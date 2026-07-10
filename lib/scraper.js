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

        function normalizeUrl(href) {
          if (!href) {
            return "";
          }

          return href.startsWith("http")
            ? href
            : `https://mixch.tv${href}`;
        }

        function extractEventId(url) {
          const match = url.match(/\/live\/event\/(\d+)/);
          return match ? match[1] : null;
        }

        function extractPeriod(text) {
          const normalizedText = String(text || "")
            .replace(/\s+/g, " ")
            .trim();

          const match = normalizedText.match(
            /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\s+\d{1,2}:\d{2})\s*[~〜]\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\s+\d{1,2}:\d{2})/
          );

          return {
            startAt: match ? match[1] : null,
            endAt: match ? match[2] : null
          };
        }

        return links
          .map((link) => {
            const href = link.getAttribute("href") || "";
            const url = normalizeUrl(href);
            const eventId = extractEventId(url);

            if (!eventId) {
              return null;
            }

            if (seen.has(url)) {
              return null;
            }

            seen.add(url);

            const img = link.querySelector("img");
            const parent =
              link.closest("article, section, li, div") || link;

            const parentText = parent.innerText || "";
            const period = extractPeriod(parentText);

            return {
              eventId,
              title: img?.getAttribute("alt")?.trim() || "",
              eventUrl: url,
              bannerImageUrl: img?.getAttribute("src") || null,
              startAt: period.startAt,
              endAt: period.endAt,
              phase: url.includes("/recruiting")
                ? "recruiting"
                : "active",
              cardText: parentText
            };
          })
          .filter(Boolean);
      }
    );

    const summary = {
      total: allEvents.length,
      active: allEvents.filter(event => event.phase === "active").length,
      recruiting: allEvents.filter(event => event.phase === "recruiting").length,
      activeWithPeriod: allEvents.filter(event =>
        event.phase === "active" &&
        event.startAt &&
        event.endAt
      ).length
    };

    console.log("Event link summary:", summary);

    const events = allEvents.filter(event => event.phase === "active");

    return {
      url: EVENTS_URL,
      events,
      fetchedAt: new Date().toISOString()
    };

  } finally {
    await browser.close();
  }
}