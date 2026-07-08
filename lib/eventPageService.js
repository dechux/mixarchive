import iconv from "iconv-lite";

export class EventPageService {
  static async open({
    page,
    event,
    timeoutMs = 60000,
    waitMs = 5000
  }) {
    if (!page) {
      throw new Error("EventPageService.open: page is required.");
    }

    if (!event?.eventUrl) {
      throw new Error("EventPageService.open: event.eventUrl is required.");
    }

    await page.goto(event.eventUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });

    await page.waitForTimeout(waitMs);

    const pageContent = await page.evaluate(() => {
      const tabs = Array.from(
        document.querySelectorAll(".nav.tabs a")
      ).map((tab, index) => ({
        key: tab.getAttribute("data-rr-ui-event-key") || "",
        label: (tab.textContent || "").trim(),
        order: index + 1
      }));

      const rankingPanel =
        document.querySelector('[id*="tabpane-ranking"]') ||
        document.querySelector('[role="tabpanel"]');

      const rankingHtml = rankingPanel
        ? rankingPanel.innerHTML
        : "";

      const ogDescription =
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content") || "";

      const bannerImageUrl =
        document
          .querySelector(".banner-img")
          ?.getAttribute("src") || "";

      return {
        tabs,
        rankingHtml,
        ogDescription,
        bannerImageUrl
      };
    });

    const detailHtml = await this.#getDetailHtmlFromIframe(page);

    return this.#repairObject({
      eventKey: event.eventKey,
      eventId: event.eventId,
      eventUrl: event.eventUrl,
      title: event.title,
      openedUrl: page.url(),
      capturedAt: new Date().toISOString(),
      ...pageContent,
      detailHtml
    });
  }

  static async #getDetailHtmlFromIframe(page) {
    const iframeCount = await page.locator("iframe").count();

    for (let i = 0; i < iframeCount; i++) {
      const iframe = await page.locator("iframe").nth(i).elementHandle();
      const frame = await iframe.contentFrame();

      if (!frame) {
        continue;
      }

      const bodyText = await frame
        .locator("body")
        .innerText()
        .catch(() => "");

      if (!bodyText || !bodyText.trim()) {
        continue;
      }

      return await frame.locator("body").innerHTML();
    }

    return "";
  }

  static #repairObject(value) {
    if (Array.isArray(value)) {
      return value.map(item => this.#repairObject(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.#repairObject(item)
        ])
      );
    }

    if (typeof value === "string") {
      return this.#repairText(value);
    }

    return value;
  }

  static #repairText(text) {
    if (this.#mojibakeScore(text) === 0) {
      return text;
    }

    try {
      return iconv.decode(
        iconv.encode(text, "cp932"),
        "utf8"
      );
    } catch {
      return text;
    }
  }

  static #mojibakeScore(text) {
    const pattern = new RegExp(
      [
        "\\u7e5d",
        "\\u7e3a",
        "\\u7e67",
        "\\u8373",
        "\\u8b5b",
        "\\u7aae",
        "\\u8708",
        "\\u9aea",
        "\\u9a5f",
        "\\u8c4e",
        "\\u8b0e",
        "\\u879f"
      ].join("|"),
      "g"
    );

    return [...String(text).matchAll(pattern)].length;
  }
}