import { chromium } from "playwright";

const EVENTS_URL = "https://mixch.tv/live/events";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("Opening events page...");

    await page.goto(EVENTS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const result = await page.$$eval(
      "a.thumb[href*='/live/event/']",
      (links) => {
        function cleanText(text) {
          return String(text || "")
            .replace(/\s+/g, " ")
            .trim();
        }

        function findDateLikeText(text) {
          const normalized = cleanText(text);

          const matches = normalized.match(
            /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}.{0,80}/g
          );

          return matches || [];
        }

        function collectParentTexts(link) {
          const parents = [];
          let current = link;

          for (let depth = 0; depth < 10; depth++) {
            if (!current) {
              break;
            }

            const text = cleanText(current.innerText);
            const dateLikeTexts = findDateLikeText(text);

            parents.push({
              depth,
              tagName: current.tagName,
              className: current.className || "",
              textLength: text.length,
              hasDateLikeText: dateLikeTexts.length > 0,
              dateLikeTexts: dateLikeTexts.slice(0, 3),
              textSample: text.slice(0, 200)
            });

            current = current.parentElement;
          }

          return parents;
        }

        function buildItem(link, index) {
          const href = link.getAttribute("href") || "";
          const img = link.querySelector("img");

          return {
            index,
            href,
            phase: href.includes("/recruiting")
              ? "recruiting"
              : "active",
            titleFromAlt: img?.getAttribute("alt") || "",
            parentTexts: collectParentTexts(link)
          };
        }

        const items = links.map((link, index) => buildItem(link, index));

        const bodyText = cleanText(document.body.innerText);
        const bodyDateLikeTexts = findDateLikeText(bodyText);

        return {
          summary: {
            total: items.length,
            recruiting: items.filter(item => item.phase === "recruiting").length,
            active: items.filter(item => item.phase === "active").length,
            bodyDateLikeTextCount: bodyDateLikeTexts.length
          },
          bodyDateLikeTexts: bodyDateLikeTexts.slice(0, 20),
          activeSamples: items
            .filter(item => item.phase === "active")
            .slice(0, 5),
          recruitingSamples: items
            .filter(item => item.phase === "recruiting")
            .slice(0, 2)
        };
      }
    );

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});