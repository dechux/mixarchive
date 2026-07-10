import { normalizeDateKey } from "./datetime.js";

/**
 * MixArchive内部で利用する一意なイベントキーを生成する。
 * eventIdの再利用に対応するため、
 * eventId + 開催期間で識別する。
 */
export function createEventKey({
  eventId,
  startAt,
  endAt
}) {
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const start = normalizeDateKey(startAt);
  const end = normalizeDateKey(endAt);

  return `${eventId}_${start}_${end}`;
}