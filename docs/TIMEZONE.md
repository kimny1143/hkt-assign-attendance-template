# タイムゾーン処理ガイド

## Supabaseのタイムゾーン仕様

### 保存形式
- Supabaseは全ての`timestamptz`型を**UTC**で保存
- APIレスポンス: ISO 8601形式（例: `2025-09-16T16:00:00+00:00`）
- `+00:00`はUTCを意味する

### 日本時間での運用

## 1. データ挿入時（推奨方法）

```sql
-- ❌ 避けるべき: タイムゾーンなしで挿入
INSERT INTO shifts (start_ts) VALUES ('2025-09-16 16:00:00');

-- ✅ 推奨: 明示的にJSTを指定
INSERT INTO shifts (start_ts) VALUES ('2025-09-16 16:00:00+09');

-- ✅ または: AT TIME ZONEを使用
INSERT INTO shifts (start_ts) VALUES ('2025-09-16 16:00:00' AT TIME ZONE 'Asia/Tokyo');
```

## 2. JavaScript/TypeScriptでの表示

```typescript
// Supabaseから取得したデータ
const shift = { start_ts: "2025-09-16T07:00:00+00:00" } // UTC 7:00 = JST 16:00

// ✅ 推奨: timeZoneを明示的に指定
const jstTime = new Date(shift.start_ts).toLocaleTimeString('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo'  // これが重要！
});
// 結果: "16:00"

// ❌ 避けるべき: timeZone指定なし（ブラウザのタイムゾーンに依存）
const ambiguousTime = new Date(shift.start_ts).toLocaleTimeString('ja-JP');
```

## 3. 日付と時刻を扱うベストプラクティス

### フロントエンド → バックエンド

```typescript
// 日本時間で入力された時刻をUTCで送信
const inputTime = "16:00"  // ユーザー入力（JST）
const inputDate = "2025-09-16"

// 日本時間の文字列を作成
const jstDateTimeStr = `${inputDate}T${inputTime}:00+09:00`
const utcDate = new Date(jstDateTimeStr)

// APIに送信
await fetch('/api/shifts', {
  method: 'POST',
  body: JSON.stringify({
    start_ts: utcDate.toISOString()  // UTC形式で送信
  })
})
```

### バックエンド → フロントエンド

```typescript
// APIレスポンス処理
const response = await fetch('/api/shifts')
const data = await response.json()

// 表示用に変換
const displayTime = new Date(data.start_ts).toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})
```

## 4. Supabase SQLでの時刻操作

```sql
-- 現在時刻（JST）で検索
SELECT * FROM shifts 
WHERE DATE(start_ts AT TIME ZONE 'Asia/Tokyo') = CURRENT_DATE;

-- JSTでの時刻表示
SELECT 
  name,
  start_ts AT TIME ZONE 'Asia/Tokyo' as start_jst,
  end_ts AT TIME ZONE 'Asia/Tokyo' as end_jst
FROM shifts;
```

## 5. 重要な注意点

1. **統一性**: プロジェクト全体で一貫した方法を使用
2. **明示的な指定**: 常に`timeZone: 'Asia/Tokyo'`を明示
3. **テスト**: 異なるタイムゾーンのブラウザでテスト
4. **夏時間**: 日本は夏時間なしだが、海外ユーザーがいる場合は考慮

## まとめ

- **保存**: UTC（Supabaseのデフォルト）
- **表示**: 日本時間（`timeZone: 'Asia/Tokyo'`を明示）
- **入力**: 日本時間で受け取り、UTCに変換して保存