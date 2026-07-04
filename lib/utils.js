export function toJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function toJstIsoString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);

  return `${parts.replace(" ", "T")}+09:00`;
}

export function normalizeDateKey(value) {
  if (!value) return "unknown";

  const text = String(value);
  const match = text.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);

  if (!match) return "unknown";

  const [, year, month, day] = match;

  return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
}

export function createEventKey({ eventId, startAt, endAt }) {
  if (!eventId) {
    throw new Error("eventId is required to create eventKey.");
  }

  const startKey = normalizeDateKey(startAt);
  const endKey = normalizeDateKey(endAt);

  return `${eventId}_${startKey}_${endKey}`;
}

export function extractProfileId(profileUrl) {
  if (!profileUrl) return null;

  const match = String(profileUrl).match(/\/u\/(\d+)/);

  return match ? match[1] : null;
}

export function parsePoints(value) {
  if (value === null || value === undefined) return null;

  const numeric = String(value).replace(/[^\d]/g, "");

  if (!numeric) return null;

  return Number(numeric);
}

export function safeFileName(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
}