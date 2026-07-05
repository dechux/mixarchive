import { createSha256Hash } from "./hash.js";
import {
  buildRawText,
  extractEventPeriod,
  extractEventPeriodFromDescription,
  normalizeSections
} from "./parsers/detailParser.js";

export class EventDetailService {
  static async fetch({ page, event }) {
    if (!page) {
      throw new Error("EventDetailService.fetch: page is required.");
    }

    if (!event?.eventUrl) {
      throw new Error("EventDetailService.fetch: event.eventUrl is required.");
    }

    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content")
      .catch(() => "");

    const iframeCount = await page.locator("iframe").count();

    if (iframeCount === 0) {
      throw new Error(`Event detail iframe not found: ${event.eventUrl}`);
    }

    const frame = await this.#findEventDetailFrame(page);

    if (!frame) {
      throw new Error(`Event detail frame not found: ${event.eventUrl}`);
    }

    const extracted = await this.#extractSectionsFromFrame(frame);

    const sections = normalizeSections(extracted.sections)
      .filter(section => section.label && section.text);

    const rawText = buildRawText(sections);

    const scheduleSection = sections.find(
      section => section.normalizedLabel === "SCHEDULE"
    );

    const periodFromDescription =
      extractEventPeriodFromDescription(ogDescription);

    const periodFromSchedule =
      extractEventPeriod(scheduleSection?.text);

    const period = periodFromDescription.startAt && periodFromDescription.endAt
      ? periodFromDescription
      : periodFromSchedule;

    const detailHash = createSha256Hash(
      JSON.stringify(
        sections.map(section => ({
          sectionId: section.sectionId,
          label: section.label,
          normalizedLabel: section.normalizedLabel,
          text: section.text,
          order: section.order
        }))
      )
    );

    return {
      eventKey: event.eventKey,
      eventId: event.eventId,
      eventUrl: event.eventUrl,
      title: event.title,
      detailCapturedAt: new Date().toISOString(),
      detailHash,
      startAt: period.startAt,
      endAt: period.endAt,
      rawText,
      sections
    };
  }

  static async #findEventDetailFrame(page) {
    const iframeCount = await page.locator("iframe").count();

    for (let i = 0; i < iframeCount; i++) {
      const iframe = await page.locator("iframe").nth(i).elementHandle();
      const frame = await iframe.contentFrame();

      if (!frame) continue;

      const text = await frame.locator("body").innerText().catch(() => "");

      if (text && text.trim().length > 0) {
        return frame;
      }
    }

    return null;
  }

  static async #extractSectionsFromFrame(frame) {
    return await frame.evaluate(() => {
      const headingSelector = "h1,h2,h3,h4,h5,h6";

      function normalize(text) {
        return (text || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function getTextUntilNextHeading(heading) {
        const texts = [];
        let node = heading.nextElementSibling;

        while (node) {
          if (node.matches?.(headingSelector)) {
            break;
          }

          const text = normalize(node.innerText);

          if (text) {
            texts.push(text);
          }

          node = node.nextElementSibling;
        }

        return texts.join("\n\n");
      }

      const headings = Array.from(
        document.querySelectorAll(headingSelector)
      );

      const sections = headings
        .map(heading => ({
          label: normalize(heading.innerText),
          text: normalize(getTextUntilNextHeading(heading))
        }))
        .filter(section => section.label && section.text);

      return {
        sections
      };
    });
  }
}