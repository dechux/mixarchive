export function toJstIsoString(date = new Date()) {
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);

  return `${text.replace(" ", "T")}+09:00`;
}

export function toJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function normalizeDateKey(value) {
  if (!value) return "unknown";

  const text = String(value);
  const match = text.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);

  if (!match) return "unknown";

  const [, year, month, day] = match;

  return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
}