# Mixch Event DB

> Unofficial MixChannel Event Database & Analytics

## Overview

Mixch Event DB は、MixChannel（ミクチャ）のイベント情報を収集し、
ランキング・ポイント推移・ライバー参加履歴などを保存・検索できる
非公式のデータベースです。

本サイトは公式サービスではありません。

---

## Main Features

- イベント検索
- ライバー検索
- プロフィールID検索
- 過去イベント一覧
- ポイント推移
- 最終日の伸び
- ライバー参加履歴
- イベント比較
- ライバー分析

---

## Directory Structure

```
data/
    current/
        events.json
        rankings/
        livers/

    archive/

    backups/

docs/

lib/

.github/
```

---

## Design Policy

- HTMLは保存しない
- 必要なデータのみ保存
- 画像は保存しない
- 非公式サイトとして運営
- eventIdではなくeventKeyを利用
- profileIdをライバーの主キーとする
- データ重複保存を防止
- エラー時は既存データを保持
- GitHub Actionsで自動更新

---

## Event Key

eventKey

```
eventId_YYYYMMDD_YYYYMMDD
```

例

```
14521_20260701_20260715
```

---

## Future Features

- ボーダー予測
- イベント比較
- ライバー比較
- ランキング推移グラフ
- お気に入りライバー
- イベント通知

---

## Development Policy

動けば良いではなく、

「長期間データを蓄積できる設計」

を最優先とする。
