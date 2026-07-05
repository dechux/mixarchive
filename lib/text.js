export function cleanText(text) {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeInlineText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLabel(label) {
  return (label || "")
    .replace(/[🔥⚠️⭐️★☆🥇🥈🥉🗓️]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}