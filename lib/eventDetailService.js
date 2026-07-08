import { createSha256Hash } from "./hash.js";
import {
  parseDetailHtml,
  normalizeSections,
  buildRawText,
  extractEventPeriod,
  extractEventPeriodFromDescription
} from "./parsers/detailParser.js";

export class EventDetailService {
  static fetch({ pageContent, event }) {
    if (!pageContent) {
      throw new Error("EventDetailService.fetch: pageContent is required.");
    }

    if (!event?.eventUrl) {
      throw new Error("EventDetailService.fetch: event.eventUrl is required.");
    }

    const parsedSections = parseDetailHtml(pageContent.detailHtml || "");
    const sections = normalizeSections(parsedSections);
    const rawText = buildRawText(sections);

    const schedule = sections.find(
      section => section.normalizedLabel === "SCHEDULE"
    );

    const periodFromDescription = extractEventPeriodFromDescription(
      pageContent.ogDescription || ""
    );

    const periodFromSchedule = extractEventPeriod(
      schedule?.text || ""
    );

    const period = periodFromDescription.startAt && periodFromDescription.endAt
      ? periodFromDescription
      : periodFromSchedule;

    const detailHash = createSha256Hash(
      JSON.stringify(sections)
    );

    return {
      eventKey: event.eventKey,
      eventId: event.eventId,
      eventUrl: event.eventUrl,
      title: event.title,
      startAt: period.startAt,
      endAt: period.endAt,
      detailCapturedAt: new Date().toISOString(),
      detailHash,
      rawText,
      sections,
      tabs: pageContent.tabs || [],
      bannerImageUrl: pageContent.bannerImageUrl || ""
    };
  }
}