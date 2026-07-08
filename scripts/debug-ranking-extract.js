import fs from "fs";

const INPUT_PATH = "logs/page.html";
const OUTPUT_PATH = "logs/ranking-only.html";
const OUTPUT_JSON_PATH = "logs/ranking-only.json";

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`${INPUT_PATH} not found.`);
  }

  const html = fs.readFileSync(INPUT_PATH, "utf8");

  const rankingMatch = html.match(
    /<div[^>]+role="tabpanel"[^>]+tabpane-ranking[\s\S]*?<\/ul>/
  );

  if (!rankingMatch) {
    throw new Error("Ranking tab HTML not found.");
  }

  const rankingHtml = rankingMatch[0];

  fs.writeFileSync(OUTPUT_PATH, rankingHtml, "utf8");

  const items = [...rankingHtml.matchAll(/<li[\s\S]*?<\/li>/g)].map((match) => {
    const li = match[0];

    const rank = li.match(/<span[^>]*>(\d+)<\/span>/)?.[1] || null;
    const profileUrl = li.match(/href="(\/u\/\d+)"/)?.[1] || null;
    const profileId = profileUrl?.match(/\/u\/(\d+)/)?.[1] || null;
    const iconUrl = li.match(/<img[^>]+src="([^"]+)"/)?.[1] || null;
    const name =
      li.match(/<span class="[^"]*ejhaeu10[^"]*">([\s\S]*?)<\/span>/)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() || null;
    const pointText =
      li.match(/<span class="num">([\s\S]*?)<\/span>/)?.[1]
        ?.replace(/,/g, "")
        .trim() || null;

    return {
      rank: rank ? Number(rank) : null,
      profileId,
      profileUrl: profileUrl ? `https://mixch.tv${profileUrl}` : null,
      name,
      point: pointText ? Number(pointText) : null,
      iconUrl
    };
  });

  fs.writeFileSync(
    OUTPUT_JSON_PATH,
    JSON.stringify(items, null, 2),
    "utf8"
  );

  console.log(`Saved: ${OUTPUT_PATH}`);
  console.log(`Saved: ${OUTPUT_JSON_PATH}`);
  console.log(`Ranking items: ${items.length}`);
  console.log(items.slice(0, 5));
}

main();