export function parseRanking(html) {
  if (!html) {
    return [];
  }

  const entries = [];

  const itemRegex = /<li[\s\S]*?<\/li>/g;
  const items = [...html.matchAll(itemRegex)];

  for (const match of items) {
    const li = match[0];

    const rank = extractRank(li);
    const profileUrl = extractProfileUrl(li);
    const profileId = extractProfileId(profileUrl);
    const name = extractName(li);
    const point = extractPoint(li);
    const iconUrl = extractIconUrl(li);

    if (!profileId) {
      continue;
    }

    entries.push({
      rank,
      profileId,
      profileUrl,
      name,
      point,
      iconUrl
    });
  }

  return entries;
}

function extractRank(html) {
  const match = html.match(/<span[^>]*>(\d+)<\/span>/);

  return match
    ? Number(match[1])
    : null;
}

function extractProfileUrl(html) {
  const match = html.match(/href="(\/u\/\d+)"/);

  if (!match) {
    return null;
  }

  return `https://mixch.tv${match[1]}`;
}

function extractProfileId(profileUrl) {
  if (!profileUrl) {
    return null;
  }

  const match = profileUrl.match(/\/u\/(\d+)/);

  return match
    ? match[1]
    : null;
}

function extractName(html) {

  const candidates = [

    /class="[^"]*ejhaeu10[^"]*"[^>]*>([\s\S]*?)<\/span>/,

    /class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/span>/

  ];

  for (const regex of candidates) {

    const match = html.match(regex);

    if (match) {

      return stripHtml(match[1]);

    }

  }

  return "";
}

function extractPoint(html) {

  const match = html.match(
    /class="num"[^>]*>([\d,]+)/
  );

  if (!match) {
    return null;
  }

  return Number(
    match[1].replace(/,/g, "")
  );
}

function extractIconUrl(html) {

  const match = html.match(
    /<img[^>]+src="([^"]+)"/
  );

  return match
    ? match[1]
    : null;
}

function stripHtml(text) {

  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}