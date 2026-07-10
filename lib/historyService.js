export function isSameHistory(a, b) {
  return (
    a?.eventKey === b?.eventKey &&
    a?.profileId === b?.profileId &&
    a?.capturedAt === b?.capturedAt &&
    a?.rank === b?.rank &&
    a?.points === b?.points
  );
}

export function hasDuplicateHistory(history = [], nextEntry) {
  return history.some((item) => isSameHistory(item, nextEntry));
}

export function appendHistory(history = [], nextEntry) {
  if (!nextEntry) {
    throw new Error("nextEntry is required.");
  }

  if (hasDuplicateHistory(history, nextEntry)) {
    return {
      added: false,
      history
    };
  }

  return {
    added: true,
    history: [...history, nextEntry]
  };
}