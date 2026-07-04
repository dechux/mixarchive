import { createEventKey } from "./eventKey.js";
import { toJstIsoString } from "./datetime.js";

export function createEventRecord({
  eventId,
  title,
  eventUrl,
  startAt,
  endAt,
  status = "unknown",
  detectedAt = toJstIsoString()
}) {
  const eventKey = createEventKey({
    eventId,
    startAt,
    endAt
  });

  return {
    eventKey,
    eventId: String(eventId),
    title: title || "",
    eventUrl: eventUrl || "",
    startAt: startAt || null,
    endAt: endAt || null,
    status,
    snapshots: [],
    createdAt: detectedAt,
    updatedAt: detectedAt
  };
}

export function updateEventRecord(existingEvent, nextEvent, snapshotId) {
  if (!existingEvent) {
    const event = { ...nextEvent };

    if (snapshotId && !event.snapshots.includes(snapshotId)) {
      event.snapshots.push(snapshotId);
    }

    return event;
  }

  const snapshots = new Set(existingEvent.snapshots || []);

  if (snapshotId) {
    snapshots.add(snapshotId);
  }

  return {
    ...existingEvent,
    title: nextEvent.title || existingEvent.title,
    eventUrl: nextEvent.eventUrl || existingEvent.eventUrl,
    startAt: nextEvent.startAt || existingEvent.startAt,
    endAt: nextEvent.endAt || existingEvent.endAt,
    status: nextEvent.status || existingEvent.status,
    snapshots: Array.from(snapshots),
    updatedAt: nextEvent.updatedAt || nextEvent.createdAt || existingEvent.updatedAt
  };
}