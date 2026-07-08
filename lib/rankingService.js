import { createSha256Hash } from "./hash.js";
import { parseRanking } from "./parsers/rankingParser.js";

export class RankingService {

  static fetch({ pageContent, event }) {

    if (!pageContent) {
      throw new Error(
        "RankingService.fetch: pageContent is required."
      );
    }

    if (!event?.eventKey) {
      throw new Error(
        "RankingService.fetch: event.eventKey is required."
      );
    }

    //
    // Parser
    //

    const entries = parseRanking(
      pageContent.rankingHtml || ""
    );

    //
    // Hash
    //

    const rankingHash = createSha256Hash(
      JSON.stringify(entries)
    );

    return {

      eventKey: event.eventKey,

      eventId: event.eventId,

      capturedAt: new Date().toISOString(),

      entryCount: entries.length,

      rankingHash,

      tabs: pageContent.tabs || [],

      entries

    };

  }

}