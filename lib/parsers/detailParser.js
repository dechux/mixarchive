import { normalizeDateKey } from "../datetime.js";

export function normalizeText(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeLabel(label) {
  if (!label) return "";

  const text = normalizeText(label);

  if (text === "ABOUT") return "ABOUT";
  if (text === "SCHEDULE") return "SCHEDULE";
  if (text === "PRIZE") return "PRIZE";
  if (text === "指定アイテム") return "指定アイテム";
  if (text === "イベントの審査基準について") return "イベントの審査基準について";

  if (text.includes("CAUTION")) return "CAUTION";
  if (text.includes("ゲリラ")) return "ゲリラ開催";

  return text;
}

export function extractEventPeriodFromDescription(description) {
  if (!description) {
    return {
      startAt: null,
      endAt: null
    };
  }

  const text = normalizeText(description);

  const match = text.match(
    /開催期間\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})\s*[~〜～]\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/
  );

  if (!match) {
    return {
      startAt: null,
      endAt: null
    };
  }

  return buildPeriod({
    startYear: Number(match[1]),
    startMonth: Number(match[2]),
    startDay: Number(match[3]),
    startHour: Number(match[4]),
    startMinute: Number(match[5]),
    endYear: Number(match[6]),
    endMonth: Number(match[7]),
    endDay: Number(match[8]),
    endHour: Number(match[9]),
    endMinute: Number(match[10])
  });
}

export function extractEventPeriod(scheduleText) {
  if (!scheduleText) {
    return {
      startAt: null,
      endAt: null
    };
  }

  const text = normalizeText(scheduleText);
  const targetText = extractPreferredPeriodText(text);

  const match = targetText.match(
    /(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2}).*?[～~〜].*?(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/
  );

  if (!match) {
    return {
      startAt: null,
      endAt: null
    };
  }

  const year = new Date().getFullYear();

  return buildPeriod({
    startYear: year,
    startMonth: Number(match[1]),
    startDay: Number(match[2]),
    startHour: Number(match[3]),
    startMinute: Number(match[4]),
    endYear: year,
    endMonth: Number(match[5]),
    endDay: Number(match[6]),
    endHour: Number(match[7]),
    endMinute: Number(match[8])
  });
}

function extractPreferredPeriodText(text) {
  const labels = ["本選", "開催期間", "イベント期間"];

  for (const label of labels) {
    const index = text.indexOf(label);

    if (index >= 0) {
      return text.slice(index);
    }
  }

  return text;
}

function buildPeriod({
  startYear,
  startMonth,
  startDay,
  startHour,
  startMinute,
  endYear,
  endMonth,
  endDay,
  endHour,
  endMinute
}) {
  const startDate = new Date(
    startYear,
    startMonth - 1,
    startDay,
    startHour,
    startMinute,
    0,
    0
  );

  const endDate = new Date(
    endYear,
    endMonth - 1,
    endDay,
    endHour === 24 ? 0 : endHour,
    endMinute,
    0,
    0
  );

  if (endHour === 24) {
    endDate.setDate(endDate.getDate() + 1);
  }

  return {
    startAt: toJstIsoStringLocal(startDate),
    endAt: toJstIsoStringLocal(endDate)
  };
}

export function buildRawText(sections = []) {
  return sections
    .map(section => {
      const title = normalizeText(section.label);
      const body = normalizeText(section.text);

      if (!body) return title;

      return `${title}\n${body}`;
    })
    .join("\n\n");
}

export function normalizeSections(sections = []) {
  return sections.map((section, index) => {
    const label = normalizeText(section.label);
    const normalizedLabel = normalizeLabel(section.label);

    return {
      sectionId: createSectionId(normalizedLabel, index),
      label,
      normalizedLabel,
      text: normalizeText(section.text),
      order: index + 1
    };
  });
}

function createSectionId(normalizedLabel, index) {
  const base = normalizeText(normalizedLabel)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");

  return `${base || "section"}-${index + 1}`;
}

export function buildDateKey(startAt, endAt) {
  return {
    startKey: normalizeDateKey(startAt),
    endKey: normalizeDateKey(endAt)
  };
}

function toJstIsoStringLocal(date) {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:00+09:00`;
}