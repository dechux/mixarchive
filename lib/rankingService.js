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
    // ランキング状態の差分判定には、
    // profileId / rank / point のみを使用する。
    //
    // 名前・プロフィールURL・アイコンURLの変更では
    // 新しいランキングSnapshotを作成しない。
    //

    const hashEntries = entries.map(entry => ({
      profileId: entry.profileId,
      rank: entry.rank,
      point: entry.point
    }));

    const rankingHash = createSha256Hash(
      JSON.stringify(hashEntries)
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