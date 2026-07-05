import path from "path";
import { backupFile, readJson, writeJsonAtomic } from "./file.js";

export class Storage {
  constructor({
    baseDir = "data",
    backupDir = "data/backups",
    enableBackup = true
  } = {}) {
    this.baseDir = baseDir;
    this.backupDir = backupDir;
    this.enableBackup = enableBackup;
  }

  // ==========================================
  // Generic
  // ==========================================

  getPath(type, key) {
    return path.join(this.baseDir, "current", type, `${key}.json`);
  }

  read(type, key) {
    return readJson(this.getPath(type, key), null);
  }

  save(type, key, data) {
    if (!key) {
      throw new Error("key is required.");
    }

    this.safeSave(this.getPath(type, key), data);
  }

  // ==========================================
  // Events
  // ==========================================

  getEventPath(eventKey) {
    return this.getPath("events", eventKey);
  }

  readEvent(eventKey) {
    return this.read("events", eventKey);
  }

  saveEvent(event) {
    if (!event?.eventKey) {
      throw new Error("event.eventKey is required.");
    }

    this.save("events", event.eventKey, event);
  }

  // ==========================================
  // Event Details
  // ==========================================

  getEventDetailPath(eventKey) {
    return this.getPath("event-details", eventKey);
  }

  readEventDetail(eventKey) {
    return this.read("event-details", eventKey);
  }

  saveEventDetail(detail) {
    if (!detail?.eventKey) {
      throw new Error("detail.eventKey is required.");
    }

    this.save("event-details", detail.eventKey, detail);
  }

  // ==========================================
  // Livers
  // ==========================================

  getLiverPath(profileId) {
    return this.getPath("livers", profileId);
  }

  readLiver(profileId) {
    return this.read("livers", profileId);
  }

  saveLiver(liver) {
    if (!liver?.profileId) {
      throw new Error("liver.profileId is required.");
    }

    this.save("livers", liver.profileId, liver);
  }

  // ==========================================
  // Snapshots
  // ==========================================

  getSnapshotPath(snapshotId) {
    return this.getPath("snapshots", snapshotId);
  }

  readSnapshot(snapshotId) {
    return this.read("snapshots", snapshotId);
  }

  saveSnapshot(snapshot) {
    if (!snapshot?.snapshotId) {
      throw new Error("snapshot.snapshotId is required.");
    }

    this.save("snapshots", snapshot.snapshotId, snapshot);
  }

  // ==========================================
  // Internal
  // ==========================================

  safeSave(filePath, data) {
    if (this.enableBackup) {
      backupFile(filePath, this.backupDir);
    }

    writeJsonAtomic(filePath, data);
  }
}