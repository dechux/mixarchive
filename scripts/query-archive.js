import {
  MixArchiveDatabase
} from "../lib/database.js";

import {
  ArchiveQueryService
} from "../lib/archiveQueryService.js";

function parseArgs(argv) {
  const options = {
    eventKey: null,
    eventName: null,
    profileId: null,
    name: null,

    timeline: false,
    detail: false,
    detailHistory: false,
    detailDiff: false,
    slowEvents: false,

    top: 10
  };

  for (const arg of argv) {
    if (arg.startsWith("--event-key=")) {
      options.eventKey = arg
        .replace(
          "--event-key=",
          ""
        )
        .trim();

      continue;
    }

    if (arg.startsWith("--event-name=")) {
      options.eventName = arg
        .replace(
          "--event-name=",
          ""
        )
        .trim();

      continue;
    }

    if (arg.startsWith("--profile-id=")) {
      options.profileId = arg
        .replace(
          "--profile-id=",
          ""
        )
        .trim();

      continue;
    }

    if (arg.startsWith("--name=")) {
      options.name = arg
        .replace(
          "--name=",
          ""
        )
        .trim();

      continue;
    }

    if (arg.startsWith("--top=")) {
      const value = Number(
        arg.replace(
          "--top=",
          ""
        )
      );

      if (
        Number.isFinite(value) &&
        value > 0
      ) {
        options.top =
          Math.floor(value);
      }

      continue;
    }

    if (arg === "--timeline") {
      options.timeline = true;
      continue;
    }

    if (arg === "--detail") {
      options.detail = true;
      continue;
    }

    if (arg === "--detail-history") {
      options.detailHistory = true;
      continue;
    }

    if (arg === "--detail-diff") {
      options.detailDiff = true;
      continue;
    }

    if (arg === "--slow-events") {
      options.slowEvents = true;
    }
  }

  return options;
}

function printUsage() {
  console.log("Usage:");
  console.log("");

  console.log(
    "Event name search:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--event-name=JCミスコン"
  );

  console.log("");

  console.log(
    "Event participants:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--event-key=24294_20260706_20260712"
  );

  console.log("");

  console.log(
    "Event detail:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--event-key=24294_20260706_20260712 " +
    "--detail"
  );

  console.log("");

  console.log(
    "Event detail history:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--event-key=24294_20260706_20260712 " +
    "--detail-history"
  );

  console.log("");

  console.log(
    "Event detail diff:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--event-key=24294_20260706_20260712 " +
    "--detail-diff"
  );

  console.log("");

  console.log(
    "Slow events:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--slow-events"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--slow-events --top=20"
  );

  console.log("");

  console.log(
    "Liver name search:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--name=すず"
  );

  console.log("");

  console.log(
    "Liver event history:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--profile-id=18065733"
  );

  console.log("");

  console.log(
    "Liver ranking timeline:"
  );

  console.log(
    "  node scripts/query-archive.js " +
    "--profile-id=18065733 " +
    "--timeline"
  );
}

function printSeparator(title) {
  console.log("");

  console.log(
    "========================================"
  );

  console.log(title);

  console.log(
    "========================================"
  );

  console.log("");
}

function formatDuration(
  durationMs
) {
  if (
    !Number.isFinite(
      durationMs
    )
  ) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  const seconds =
    durationMs / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(2)} sec`;
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainingSeconds =
    seconds % 60;

  return (
    `${minutes} min ` +
    `${remainingSeconds.toFixed(2)} sec`
  );
}

function getSectionDisplayName(
  section
) {
  if (
    section.occurrence > 1
  ) {
    return (
      `${section.label} ` +
      `(同名セクション ` +
      `${section.occurrence}件目)`
    );
  }

  return section.label;
}

function printTextPreview(
  queryService,
  text,
  indent = "    "
) {
  const normalized =
    queryService
      .normalizeSectionText(
        text
      );

  if (!normalized) {
    console.log(
      `${indent}(empty)`
    );

    return;
  }

  const maxLength = 300;

  const preview =
    normalized.length > maxLength
      ? normalized.slice(
          0,
          maxLength
        ) + "..."
      : normalized;

  const lines =
    preview.split("\n");

  for (const line of lines) {
    console.log(
      `${indent}${line}`
    );
  }
}

function printEventNameSearch({
  queryService,
  eventName
}) {
  printSeparator(
    "Event name search"
  );

  console.log(
    `Search event name: ${eventName}`
  );

  console.log("");

  const matches =
    queryService
      .searchEventsByName(
        eventName
      );

  if (matches.length === 0) {
    console.log(
      "No matching events found."
    );

    return;
  }

  console.log(
    `Matches: ${matches.length}`
  );

  console.log("");

  for (const event of matches) {
    console.log(
      event.title ||
      "(no title)"
    );

    console.log(
      `  eventKey: ${event.eventKey}`
    );

    console.log(
      `  eventId: ${event.eventId}`
    );

    console.log(
      `  startAt: ${event.startAt ?? "-"}`
    );

    console.log(
      `  endAt: ${event.endAt ?? "-"}`
    );

    console.log(
      `  status: ${event.status ?? "-"}`
    );

    if (event.eventUrl) {
      console.log(
        `  eventUrl: ${event.eventUrl}`
      );
    }

    console.log("");
  }
}

function printNameSearch({
  queryService,
  name
}) {
  printSeparator(
    "Liver name search"
  );

  console.log(
    `Search name: ${name}`
  );

  console.log("");

  const matches =
    queryService
      .searchLiversByName(
        name
      );

  if (matches.length === 0) {
    console.log(
      "No matching livers found."
    );

    return;
  }

  console.log(
    `Matches: ${matches.length}`
  );

  console.log("");

  for (const match of matches) {
    console.log(
      match.currentName ||
      "(no current name)"
    );

    console.log(
      `  profileId: ${match.profileId}`
    );

    if (match.profileUrl) {
      console.log(
        `  profileUrl: ${match.profileUrl}`
      );
    }

    console.log(
      "  matchedNames:"
    );

    for (
      const matchedName of
      match.matchedNames
    ) {
      console.log(
        `    ${matchedName.name} ` +
        `/ ${matchedName.matchedBy}`
      );
    }

    console.log("");
  }
}

function printEventParticipants({
  queryService,
  eventKey
}) {
  printSeparator(
    "Event participants"
  );

  console.log(
    `eventKey: ${eventKey}`
  );

  console.log("");

  const participants =
    queryService
      .getEventParticipantHistory(
        eventKey
      );

  if (participants.length === 0) {
    console.log(
      "No participants found."
    );

    return;
  }

  console.log(
    `Participants: ${participants.length}`
  );

  console.log("");

  for (
    const participant of
    participants
  ) {
    const latestRank =
      participant.latestRank ?? "-";

    const name =
      participant.currentName ||
      "(no name)";

    console.log(
      `${latestRank}位 / ${name}`
    );

    console.log(
      `  profileId: ${participant.profileId}`
    );

    console.log(
      `  firstRank: ${participant.firstRank ?? "-"}`
    );

    console.log(
      `  latestRank: ${participant.latestRank ?? "-"}`
    );

    console.log(
      `  bestRank: ${participant.bestRank ?? "-"}`
    );

    console.log(
      `  firstPoint: ${participant.firstPoint ?? "-"}`
    );

    console.log(
      `  latestPoint: ${participant.latestPoint ?? "-"}`
    );

    console.log(
      `  maxPoint: ${participant.maxPoint ?? "-"}`
    );

    console.log(
      `  snapshots: ${participant.snapshotCount}`
    );

    if (
      participant.firstCapturedAt
    ) {
      console.log(
        `  firstCapturedAt: ${participant.firstCapturedAt}`
      );
    }

    if (
      participant.latestCapturedAt
    ) {
      console.log(
        `  latestCapturedAt: ${participant.latestCapturedAt}`
      );
    }

    console.log("");
  }
}

function printLiverEventHistory({
  queryService,
  profileId
}) {
  printSeparator(
    "Liver event history"
  );

  console.log(
    `profileId: ${profileId}`
  );

  console.log("");

  const eventHistory =
    queryService
      .getLiverEventHistory(
        profileId
      );

  if (eventHistory.length === 0) {
    console.log(
      "No event history found."
    );

    return;
  }

  console.log(
    `Events: ${eventHistory.length}`
  );

  console.log("");

  for (
    const event of
    eventHistory
  ) {
    console.log(
      event.title ||
      "(no title)"
    );

    console.log(
      `  eventKey: ${event.eventKey}`
    );

    console.log(
      `  firstRank: ${event.firstRank ?? "-"}`
    );

    console.log(
      `  latestRank: ${event.latestRank ?? "-"}`
    );

    console.log(
      `  bestRank: ${event.bestRank ?? "-"}`
    );

    console.log(
      `  firstPoint: ${event.firstPoint ?? "-"}`
    );

    console.log(
      `  latestPoint: ${event.latestPoint ?? "-"}`
    );

    console.log(
      `  maxPoint: ${event.maxPoint ?? "-"}`
    );

    console.log(
      `  snapshots: ${event.snapshotCount}`
    );

    if (
      event.firstCapturedAt
    ) {
      console.log(
        `  firstCapturedAt: ${event.firstCapturedAt}`
      );
    }

    if (
      event.latestCapturedAt
    ) {
      console.log(
        `  latestCapturedAt: ${event.latestCapturedAt}`
      );
    }

    console.log("");
  }
}

function printLiverTimeline({
  queryService,
  profileId
}) {
  printSeparator(
    "Liver ranking timeline"
  );

  console.log(
    `profileId: ${profileId}`
  );

  console.log("");

  const history =
    queryService
      .getLiverTimeline(
        profileId
      );

  if (history.length === 0) {
    console.log(
      "No ranking timeline found."
    );

    return;
  }

  console.log(
    `Snapshots: ${history.length}`
  );

  console.log("");

  for (const item of history) {
    console.log(
      item.title ||
      "(no title)"
    );

    console.log(
      `  eventKey: ${item.eventKey}`
    );

    console.log(
      `  rank: ${item.rank ?? "-"}`
    );

    console.log(
      `  point: ${item.point ?? "-"}`
    );

    if (item.capturedAt) {
      console.log(
        `  capturedAt: ${item.capturedAt}`
      );
    }

    console.log("");
  }
}

function printEventDetail({
  queryService,
  eventKey
}) {
  printSeparator(
    "Event detail"
  );

  const event =
    queryService
      .getEventRecord(
        eventKey
      );

  if (!event) {
    console.log(
      `Event not found: ${eventKey}`
    );

    return;
  }

  const detail =
    queryService
      .getEventDetailRecord(
        eventKey
      );

  const participants =
    queryService
      .getEventParticipantHistory(
        eventKey
      );

  const latestRanking =
    queryService
      .getLatestEventRanking(
        eventKey
      );

  const snapshotCount =
    queryService
      .getEventSnapshotCount(
        eventKey
      );

  const sections =
    queryService
      .normalizeEventSections(
        detail
      );

  const tabs =
    queryService
      .normalizeEventTabs(
        detail
      );

  console.log(
    event.title ||
    "(no title)"
  );

  console.log("");

  console.log(
    `eventKey: ${event.event_key}`
  );

  console.log(
    `eventId: ${event.event_id || "-"}`
  );

  console.log(
    `status: ${event.status || "-"}`
  );

  console.log(
    `startAt: ${event.start_at || "-"}`
  );

  console.log(
    `endAt: ${event.end_at || "-"}`
  );

  console.log(
    `participants: ${participants.length}`
  );

  console.log(
    `snapshots: ${snapshotCount}`
  );

  if (event.event_url) {
    console.log(
      `eventUrl: ${event.event_url}`
    );
  }

  if (event.created_at) {
    console.log(
      `createdAt: ${event.created_at}`
    );
  }

  if (event.updated_at) {
    console.log(
      `updatedAt: ${event.updated_at}`
    );
  }

  if (detail?.captured_at) {
    console.log(
      `detailCapturedAt: ${detail.captured_at}`
    );
  }

  if (detail?.detail_hash) {
    console.log(
      `detailHash: ${detail.detail_hash}`
    );
  }

  console.log("");

  console.log(
    "----------------------------------------"
  );

  console.log(
    "Latest ranking"
  );

  console.log(
    "----------------------------------------"
  );

  console.log("");

  if (
    !latestRanking.snapshot ||
    latestRanking.entries.length === 0
  ) {
    console.log(
      "No ranking snapshot found."
    );
  } else {
    console.log(
      `capturedAt: ${
        latestRanking
          .snapshot
          .capturedAt ||
        "-"
      }`
    );

    console.log(
      `entries: ${latestRanking.entries.length}`
    );

    console.log("");

    for (
      const entry of
      latestRanking.entries
    ) {
      console.log(
        `${entry.rank ?? "-"}位 / ` +
        `${entry.currentName || "(no name)"}`
      );

      console.log(
        `  profileId: ${entry.profileId}`
      );

      console.log(
        `  point: ${entry.point ?? "-"}`
      );
    }
  }

  console.log("");

  console.log(
    "----------------------------------------"
  );

  console.log(
    "Event sections"
  );

  console.log(
    "----------------------------------------"
  );

  console.log("");

  if (tabs.length > 0) {
    console.log(
      `Tabs: ${tabs.join(" / ")}`
    );

    console.log("");
  }

  if (sections.length === 0) {
    console.log(
      "No event sections found."
    );

    return;
  }

  for (const section of sections) {
    console.log(
      `[${section.label}]`
    );

    console.log("");

    console.log(
      section.text ||
      "(empty)"
    );

    console.log("");
  }
}

function printEventDetailHistory({
  queryService,
  eventKey
}) {
  printSeparator(
    "Event detail history"
  );

  const event =
    queryService
      .getEventRecord(
        eventKey
      );

  if (!event) {
    console.log(
      `Event not found: ${eventKey}`
    );

    return;
  }

  const history =
    queryService
      .getEventDetailHistory(
        eventKey
      );

  console.log(
    event.title ||
    "(no title)"
  );

  console.log("");

  console.log(
    `eventKey: ${eventKey}`
  );

  console.log(
    `History count: ${history.length}`
  );

  console.log("");

  if (history.length === 0) {
    console.log(
      "No event detail history found."
    );

    return;
  }

  for (
    let index = 0;
    index < history.length;
    index += 1
  ) {
    const item =
      history[index];

    const sections =
      queryService
        .parseJsonValue(
          item.sections_json,
          []
        );

    const sectionLabels =
      Array.isArray(sections)
        ? sections
            .map(section =>
              section?.label ||
              section?.normalizedLabel ||
              ""
            )
            .filter(Boolean)
        : [];

    console.log(
      `History ${index + 1}`
    );

    console.log(
      `  capturedAt: ${item.captured_at || "-"}`
    );

    console.log(
      `  detailHash: ${item.detail_hash || "-"}`
    );

    console.log(
      `  sections: ${
        Array.isArray(sections)
          ? sections.length
          : 0
      }`
    );

    if (
      sectionLabels.length > 0
    ) {
      console.log(
        `  sectionLabels: ${sectionLabels.join(" / ")}`
      );
    }

    console.log("");
  }
}

function printEventDetailDiff({
  queryService,
  eventKey
}) {
  printSeparator(
    "Event detail diff"
  );

  const result =
    queryService
      .getEventDetailDiff(
        eventKey
      );

  if (!result.event) {
    console.log(
      `Event not found: ${eventKey}`
    );

    return;
  }

  console.log(
    result.event.title ||
    "(no title)"
  );

  console.log("");

  console.log(
    `eventKey: ${eventKey}`
  );

  console.log(
    `History count: ${result.historyCount}`
  );

  console.log("");

  if (result.historyCount < 2) {
    console.log(
      "At least 2 detail history records are required for comparison."
    );

    console.log("");

    console.log(
      "Current detail history has only one version, so there is nothing to compare yet."
    );

    return;
  }

  for (
    const change of
    result.changes
  ) {
    const diff =
      change.diff;

    console.log(
      "----------------------------------------"
    );

    console.log(
      `Change ${change.index}`
    );

    console.log(
      "----------------------------------------"
    );

    console.log("");

    console.log(
      `Previous capturedAt: ${
        change.previous.capturedAt ||
        "-"
      }`
    );

    console.log(
      `Current capturedAt:  ${
        change.current.capturedAt ||
        "-"
      }`
    );

    console.log(
      `Previous hash: ${
        change.previous.detailHash ||
        "-"
      }`
    );

    console.log(
      `Current hash:  ${
        change.current.detailHash ||
        "-"
      }`
    );

    console.log("");

    console.log(
      `Added sections:   ${diff.added.length}`
    );

    console.log(
      `Changed sections: ${diff.changed.length}`
    );

    console.log(
      `Removed sections: ${diff.removed.length}`
    );

    console.log(
      `Unchanged:        ${diff.unchanged.length}`
    );

    console.log("");

    if (diff.added.length > 0) {
      console.log(
        "[Added sections]"
      );

      console.log("");

      for (
        const section of
        diff.added
      ) {
        console.log(
          `+ ${getSectionDisplayName(section)}`
        );

        printTextPreview(
          queryService,
          section.text
        );

        console.log("");
      }
    }

    if (
      diff.changed.length > 0
    ) {
      console.log(
        "[Changed sections]"
      );

      console.log("");

      for (
        const section of
        diff.changed
      ) {
        console.log(
          `* ${getSectionDisplayName(section)}`
        );

        console.log(
          "  Before:"
        );

        printTextPreview(
          queryService,
          section.previousText,
          "    "
        );

        console.log("");

        console.log(
          "  After:"
        );

        printTextPreview(
          queryService,
          section.currentText,
          "    "
        );

        console.log("");
      }
    }

    if (
      diff.removed.length > 0
    ) {
      console.log(
        "[Removed sections]"
      );

      console.log("");

      for (
        const section of
        diff.removed
      ) {
        console.log(
          `- ${getSectionDisplayName(section)}`
        );

        printTextPreview(
          queryService,
          section.text
        );

        console.log("");
      }
    }

    if (
      diff.added.length === 0 &&
      diff.changed.length === 0 &&
      diff.removed.length === 0
    ) {
      console.log(
        "No section-level changes detected."
      );

      console.log("");
    }
  }
}

function printSlowEvents({
  queryService,
  top
}) {
  printSeparator(
    "Slow events"
  );

  const events =
    queryService.getSlowEvents(
      top
    );

  console.log(
    `Top: ${top}`
  );

  console.log("");

  if (events.length === 0) {
    console.log(
      "No duration data found."
    );

    console.log("");

    console.log(
      "Run update-archive.js after durationMs support was added."
    );

    return;
  }

  console.log(
    `Events with duration data: ${events.length}`
  );

  console.log("");

  for (
    let index = 0;
    index < events.length;
    index += 1
  ) {
    const event =
      events[index];

    console.log(
      `${index + 1}. ` +
      `${event.title || "(no title)"}`
    );

    console.log(
      `  eventKey: ${event.eventKey}`
    );

    console.log(
      `  average: ${formatDuration(event.averageDurationMs)}`
    );

    console.log(
      `  maximum: ${formatDuration(event.maxDurationMs)}`
    );

    console.log(
      `  minimum: ${formatDuration(event.minDurationMs)}`
    );

    console.log(
      `  measurements: ${event.measurementCount}`
    );

    console.log(
      `  latestCapturedAt: ${event.latestCapturedAt || "-"}`
    );

    console.log(
      `  status: ${event.status || "-"}`
    );

    if (event.eventUrl) {
      console.log(
        `  eventUrl: ${event.eventUrl}`
      );
    }

    console.log("");
  }
}

function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  if (
    !options.eventKey &&
    !options.eventName &&
    !options.profileId &&
    !options.name &&
    !options.slowEvents
  ) {
    printUsage();

    process.exitCode = 1;

    return;
  }

  const database =
    new MixArchiveDatabase();

  const queryService =
    new ArchiveQueryService(
      database
    );

  try {
    if (options.slowEvents) {
      printSlowEvents({
        queryService,
        top:
          options.top
      });
    }

    if (options.eventName) {
      printEventNameSearch({
        queryService,
        eventName:
          options.eventName
      });
    }

    if (options.name) {
      printNameSearch({
        queryService,
        name:
          options.name
      });
    }

    if (options.eventKey) {
      if (options.detailDiff) {
        printEventDetailDiff({
          queryService,
          eventKey:
            options.eventKey
        });
      } else if (
        options.detailHistory
      ) {
        printEventDetailHistory({
          queryService,
          eventKey:
            options.eventKey
        });
      } else if (
        options.detail
      ) {
        printEventDetail({
          queryService,
          eventKey:
            options.eventKey
        });
      } else {
        printEventParticipants({
          queryService,
          eventKey:
            options.eventKey
        });
      }
    }

    if (options.profileId) {
      if (options.timeline) {
        printLiverTimeline({
          queryService,
          profileId:
            options.profileId
        });
      } else {
        printLiverEventHistory({
          queryService,
          profileId:
            options.profileId
        });
      }
    }
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error(
    "Archive query failed."
  );

  console.error(error);

  process.exit(1);
}