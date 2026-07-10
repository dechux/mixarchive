import fs from "fs";
import { chromium } from "playwright";

const EVENT_URL = "https://mixch.tv/live/event/14521";

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

    console.log("Opening ranking page...");

    await page.goto(EVENT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // ランキングが描画されるまで少し待つ
    await page.waitForTimeout(10000);

    console.log("URL :", page.url());
    console.log("TITLE:", await page.title());

    // HTML全体保存
    fs.writeFileSync(
      "logs/page.html",
      await page.content(),
      "utf8"
    );

    console.log("Saved: logs/page.html");

    // デバッグ用JSON
    const debug = await page.evaluate(() => {

      return Array.from(
        document.querySelectorAll("main,article,section,ul,li,div,a,img,span,p")
      )
        .map((el, index) => ({

          index,

          tag: el.tagName,

          className: el.className,

          id: el.id,

          href: el.getAttribute("href"),

          src: el.getAttribute("src"),

          alt: el.getAttribute("alt"),

          text: (el.innerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 300),

          html: el.outerHTML.substring(0, 800)

        }))
        .filter(item =>
          item.text ||
          item.href ||
          item.src ||
          item.alt
        );

    });

    fs.writeFileSync(
      "logs/ranking-debug.json",
      JSON.stringify(debug, null, 2),
      "utf8"
    );

    console.log("Saved: logs/ranking-debug.json");

    await page.screenshot({
      path: "logs/ranking-debug.png",
      fullPage: true
    });

    console.log("Saved: logs/ranking-debug.png");

  }
  finally {

    await browser.close();

  }

}

main().catch(console.error);