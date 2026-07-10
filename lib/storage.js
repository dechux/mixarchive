import fs from "fs";
import path from "path";

import {
  backupFile,
  readJson,
  writeJsonAtomic
} from "./file.js";

export class Storage {
  constructor({
    baseDir = "data/current",
    backupDir = "data/backups",
    enableBackup = true
  } = {}) {
    this.baseDir = baseDir;
    this.backupDir = backupDir;
    this.enableBackup = enableBackup;
  }

  getEventPath(eventKey) {
    return path.join(
      this.baseDir,
      "events",
      `${eventKey}.json`
    );
  }

  getEventDetailPath(eventKey) {
    return path.join(
      this.baseDir,
      "event-details",
      `${eventKey}.json`
    );
  }

  getEventDetailHistoryPath(
    eventKey,
    detailHash
  ) {
    return path.join(
      this.baseDir,
      "event-detail-history",
      eventKey,
      `${detailHash}.json`
    );
  }

  getRankingPath(eventKey) {
    return path.join(
      this.baseDir,
      "rankings",
      `${eventKey}.json`
    );
  }

  getLiverPath(profileId) {
    return path.join(
      this.baseDir,
      "livers",
      `${profileId}.json`
    );
  }

  getSnapshotPath(snapshotId) {
    return path.join(
      this.baseDir,
      "snapshots",
      `${snapshotId}.json`
    );
  }

  getPageCachePath(eventKey) {
    return path.join(
      this.baseDir,
      "page-cache",
      `${eventKey}.json`
    );
  }

  readEvent(eventKey) {
    return readJson(
      this.getEventPath(eventKey),
      null
    );
  }

  readEventDetail(eventKey) {
    return readJson(
      this.getEventDetailPath(eventKey),
      null
    );
  }

  readEventDetailHistory(
    eventKey,
    detailHash
  ) {
    return readJson(
      this.getEventDetailHistoryPath(
        eventKey,
        detailHash
      ),
      null
    );
  }

  hasEventDetailHistory(
    eventKey,
    detailHash
  ) {
    return fs.existsSync(
      this.getEventDetailHistoryPath(
        eventKey,
        detailHash
      )
    );
  }

  readRanking(eventKey) {
    return readJson(
      this.getRankingPath(eventKey),
      null
    );
  }

  readLiver(profileId) {
    return readJson(
      this.getLiverPath(profileId),
      null
    );
  }

  readSnapshot(snapshotId) {
    return readJson(
      this.getSnapshotPath(snapshotId),
      null
    );
  }

  readPageCache(eventKey) {
    return readJson(
      this.getPageCachePath(eventKey),
      null
    );
  }

  saveEvent(event) {
    if (!event?.eventKey) {
      throw new Error(
        "event.eventKey is required."
      );
    }

    this.safeSave(
      this.getEventPath(event.eventKey),
      event
    );
  }

  saveEventDetail(detail) {
    if (!detail?.eventKey) {
      throw new Error(
        "detail.eventKey is required."
      );
    }

    this.safeSave(
      this.getEventDetailPath(
        detail.eventKey
      ),
      detail
    );
  }

  saveEventDetailHistory(detail) {
    if (!detail?.eventKey) {
      throw new Error(
        "detail.eventKey is required."
      );
    }

    if (!detail?.detailHash) {
      throw new Error(
        "detail.detailHash is required."
      );
    }

    const filePath =
      this.getEventDetailHistoryPath(
        detail.eventKey,
        detail.detailHash
      );

    if (fs.existsSync(filePath)) {
      return {
        saved: false,
        reason: "duplicate-detail-hash",
        filePath
      };
    }

    writeJsonAtomic(
      filePath,
      detail
    );

    return {
      saved: true,
      reason: "new-detail-hash",
      filePath
    };
  }

  saveRanking(ranking) {
    if (!ranking?.eventKey) {
      throw new Error(
        "ranking.eventKey is required."
      );
    }

    this.safeSave(
      this.getRankingPath(
        ranking.eventKey
      ),
      ranking
    );
  }

  saveLiver(liver) {
    if (!liver?.profileId) {
      throw new Error(
        "liver.profileId is required."
      );
    }

    this.safeSave(
      this.getLiverPath(
        liver.profileId
      ),
      liver
    );
  }

  saveSnapshot(snapshot) {
    if (!snapshot?.snapshotId) {
      throw new Error(
        "snapshot.snapshotId is required."
      );
    }

    this.safeSave(
      this.getSnapshotPath(
        snapshot.snapshotId
      ),
      snapshot
    );
  }

  savePageCache(pageCache) {
    if (!pageCache?.eventKey) {
      throw new Error(
        "pageCache.eventKey is required."
      );
    }

    this.safeSave(
      this.getPageCachePath(
        pageCache.eventKey
      ),
      pageCache
    );
  }

  safeSave(filePath, data) {
    if (this.enableBackup) {
      backupFile(
        filePath,
        this.backupDir
      );
    }

    writeJsonAtomic(
      filePath,
      data
    );
  }
}