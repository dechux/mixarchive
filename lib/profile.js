export function extractProfileId(profileUrl) {
  if (!profileUrl) return null;

  const match = String(profileUrl).match(/\/u\/(\d+)/);

  return match ? match[1] : null;
}

export function normalizeLiverName(name) {
  if (!name) return "";

  return String(name)
    .replace(/\s+/g, " ")
    .trim();
}

export function createProfileUrl(profileId) {
  if (!profileId) return null;

  return `https://mixch.tv/u/${profileId}`;
}