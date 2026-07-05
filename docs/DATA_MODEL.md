# MixArchive Data Model v1.0

Last Update: 2026-07-05

---

# Overview

MixArchive stores only structured data.

No HTML or image assets are stored.

The data model is designed for long-term accumulation and future database migration.

---

# Entity Relationship

```
Event
   │
   ├────────────┐
   │            │
RankingEntry    Snapshot
   │            │
   └──────┐     │
          │     │
        Liver ──┘
```

---

# 1. Event

Represents one MixChannel event.

Primary Key

```
eventKey
```

Fields

| Field | Description |
|--------|-------------|
| eventKey | Internal unique ID |
| eventId | MixChannel event ID |
| title | Event title |
| eventUrl | Event URL |
| startAt | Event start datetime |
| endAt | Event end datetime |
| status | upcoming / running / finished |
| description | Event description text |
| benefits | Event rewards / benefits |
| requirements | Entry requirements |
| detailCapturedAt | Event detail capture time |
| participantCount | Number of saved participants |
| snapshots | Snapshot IDs |
| createdAt | First detected time |
| updatedAt | Last updated time |
---

# 2. Liver

Represents one liver.

Primary Key

```
profileId
```

Fields

| Field | Description |
|--------|-------------|
| profileId | MixChannel profile ID |
| currentName | Latest liver name |
| nameHistory | Previous names |
| profileUrl | Official profile URL |
| firstSeenAt | First detection |
| lastSeenAt | Last detection |
| eventKeys | Participated events |

---

# 3. RankingEntry

Represents one ranking record.

Composite Key

```
eventKey
+
profileId
+
capturedAt
```

Fields

| Field | Description |
|--------|-------------|
| eventKey | Event |
| profileId | Liver |
| rank | Ranking |
| points | Total points |
| capturedAt | Actual capture time |
| scheduledAt | Scheduled execution time |
| sourceUrl | Source page |

---

# 4. Snapshot

Represents one scraping execution.

Fields

| Field | Description |
|--------|-------------|
| snapshotId | Unique snapshot ID |
| capturedAt | Actual capture time |
| scheduledAt | Scheduled execution time |
| eventCount | Events scraped |
| rankingCount | Rankings scraped |
| durationMs | Execution time |
| status | success / partial / failed |

---

# 5. Metadata

Project metadata.

Fields

| Field | Description |
|--------|-------------|
| schemaVersion | Current schema |
| generatorVersion | MixArchive version |
| lastRun | Last execution |
| lastSuccess | Last successful execution |

---

# Data Rules

## Event

eventKey is immutable.

Event detail text may be updated when the official event page changes.

---

## Liver

profileId is immutable.

Names may change.

---

## Ranking

History is append-only.

Never overwrite history.

---

## Snapshot

Every successful scraping creates exactly one Snapshot.

---

# Duplicate Rules

Never insert when

eventKey

+

profileId

+

capturedAt

+

rank

+

points

are identical.

---

# Failure Rules

If scraping fails,

no Event,

no Liver,

no Ranking,

no Snapshot

shall be overwritten.

---

# Migration

Current storage

JSON

↓

Future

SQLite

↓

Future

Supabase

The model must remain compatible.