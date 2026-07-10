export function parseEventsFromHtml(html) {
  if (!html) return [];

  const events = [];
  const seen = new Set();

  const linkRegex = /<a[^>]+href=["']([^"']*\/live\/event\/(\d+)\/[^"']*)["'][\s\S]*?<\/a>/g;

  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = normalizeMixchUrl(match[1]);
    const eventId = match[2];

    if (seen.has(url)) continue;
    seen.add(url);

    const block = match[0];
    const text = stripHtml(block);

    const title = extractTitle(text);
    const period = extractPeriod(text);

    events.push({
      eventId,
      title,
      eventUrl: url,
      startAt: period.startAt,
      endAt: period.endAt
    });
  }

  return events;
}

function normalizeMixchUrl(url) {
  if (url.startsWith("http")) return url;
  return `https://mixch.tv${url}`;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(text) {
  const cleaned = text.replace(/開催期間.*$/g, "").trim();
  return cleaned || "";
}

function extractPeriod(text) {
  const match = text.match(
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\s+\d{1,2}:\d{2})\s*[~〜]\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\s+\d{1,2}:\d{2})/
  );

  return {
    startAt: match ? match[1] : null,
    endAt: match ? match[2] : null
  };
}