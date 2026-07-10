export function updateLiverRecord({
  existingLiver = null,
  rankingEntry,
  eventKey,
  seenAt
}) {
  if (!rankingEntry?.profileId) {
    throw new Error(
      "updateLiverRecord: rankingEntry.profileId is required."
    );
  }

  if (!eventKey) {
    throw new Error(
      "updateLiverRecord: eventKey is required."
    );
  }

  const currentSeenAt =
    seenAt ||
    new Date().toISOString();

  const profileId = String(rankingEntry.profileId);

  const currentName =
    rankingEntry.name ||
    existingLiver?.currentName ||
    "";

  const profileUrl =
    rankingEntry.profileUrl ||
    existingLiver?.profileUrl ||
    null;

  const iconUrl =
    rankingEntry.iconUrl ||
    existingLiver?.iconUrl ||
    null;

  const firstSeenAt =
    existingLiver?.firstSeenAt ||
    currentSeenAt;

  const eventKeys = new Set(
    Array.isArray(existingLiver?.eventKeys)
      ? existingLiver.eventKeys
      : []
  );

  eventKeys.add(eventKey);

  const nameHistory = updateNameHistory({
    existingHistory: existingLiver?.nameHistory,
    currentName,
    seenAt: currentSeenAt
  });

  return {
    profileId,
    currentName,
    nameHistory,
    profileUrl,
    iconUrl,
    firstSeenAt,
    lastSeenAt: currentSeenAt,
    eventKeys: Array.from(eventKeys)
  };
}

function updateNameHistory({
  existingHistory,
  currentName,
  seenAt
}) {
  const history = normalizeNameHistory(existingHistory);

  if (!currentName) {
    return history;
  }

  const existingEntry = history.find(
    item => item.name === currentName
  );

  if (existingEntry) {
    existingEntry.lastSeenAt = seenAt;

    return history;
  }

  history.push({
    name: currentName,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt
  });

  return history;
}

function normalizeNameHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((item) => {
      if (typeof item === "string") {
        return {
          name: item,
          firstSeenAt: null,
          lastSeenAt: null
        };
      }

      if (
        item &&
        typeof item === "object" &&
        item.name
      ) {
        return {
          name: item.name,
          firstSeenAt: item.firstSeenAt || null,
          lastSeenAt: item.lastSeenAt || null
        };
      }

      return null;
    })
    .filter(Boolean);
}