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

    const result = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll("a[href*='/live/event/']")
      ).slice(0, 10);

      return links.map((link, index) => {
        const parent = link.closest("article, section, li, div") || link;

        return {
          index,
          href: link.href,
          linkText: link.innerText,
          parentText: parent.innerText,
          linkHtml: link.outerHTML.slice(0, 3000),
          parentHtml: parent.outerHTML.slice(0, 5000)
        };
      });
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});