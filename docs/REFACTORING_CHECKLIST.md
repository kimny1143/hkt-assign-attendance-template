# タイムゾーン処理リファクタリングチェックリスト

## 概要

このドキュメントは、既存コードのタイムゾーン処理を新しいユーティリティに移行するためのチェックリストです。優先度に基づいて段階的に移行を進めてください。

## 優先度レベル

- 🔴 **P0 (Critical)**: 即座に対応が必要（データ不整合のリスク）
- 🟠 **P1 (High)**: 次のスプリントで対応
- 🟡 **P2 (Medium)**: 計画的に対応
- 🟢 **P3 (Low)**: 余裕があれば対応

---

## リファクタリング対象ファイル

### 🔴 P0: クリティカルなページ（打刻・勤怠管理）

#### 1. `/app/punch/page.tsx`
**現状の問題:**
- [ ] 行119-125: `formatTime()` の独自実装
- [ ] 日付表示が一貫していない

**修正方法:**
```typescript
// Before
const formatTime = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// After
import { formatTime } from '@/lib/utils/date';
```

**テスト項目:**
- [ ] 打刻時刻が正しくJSTで表示される
- [ ] GPS情報と時刻の整合性
- [ ] QRコード期限の判定

---

#### 2. `/app/admin/attendance/page.tsx`
**現状の問題:**
- [ ] 行117-123: `formatTime()` の独自実装
- [ ] 行109-115: `calculateWorkHours()` の独自実装
- [ ] 選択日付のタイムゾーン処理が曖昧

**修正方法:**
```typescript
// Before
const calculateWorkHours = (checkin: string | null, checkout: string | null) => {
  if (!checkin || !checkout) return '-';
  const start = new Date(checkin);
  const end = new Date(checkout);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return `${hours.toFixed(1)}時間`;
};

// After
import { calculateWorkHours } from '@/lib/utils/date';
// 使用
const hours = calculateWorkHours(checkin, checkout, 'japanese');
```

**テスト項目:**
- [ ] 勤務時間計算の正確性
- [ ] 日付フィルタリングの動作
- [ ] CSV出力時のタイムゾーン

---

### 🟠 P1: 管理画面の主要ページ

#### 3. `/app/admin/events/page.tsx`
**現状の問題:**
- [ ] 行143-150: `formatDate()` の独自実装
- [ ] 行152-170: `formatTime()` の独自実装（time型の特殊処理）

**修正方法:**
```typescript
// Before
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// After
import { formatDate } from '@/lib/utils/date';
// 使用
const displayDate = formatDate(event.event_date, 'DATE_JP');
```

**テスト項目:**
- [ ] イベント日付の正しい表示
- [ ] 開場・開演・終演時刻の表示
- [ ] イベント作成時のタイムゾーン処理

---

#### 4. `/app/admin/shifts/page.tsx`
**現状の問題:**
- [ ] 行167-185: `formatTime()` の独自実装（正規表現での時刻抽出）
- [ ] 行100-101: タイムスタンプの手動構築
- [ ] 行140-141: `toTimeString()` の使用

**修正方法:**
```typescript
// Before
const formatTime = (dateStr: string) => {
  const timeMatch = dateStr.match(/T(\d{2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }
  // ...
};

// After
import { formatTime, toSupabaseTimestamp } from '@/lib/utils/date';
```

**テスト項目:**
- [ ] シフト時間の正しい表示
- [ ] シフト作成・編集時の時刻処理
- [ ] イベント時間との整合性チェック

---

#### 5. `/app/admin/assign/page.tsx`
**現状の問題:**
- [ ] タイムゾーン処理の実装確認が必要

**修正方法:**
```typescript
import { useJSTDate } from '@/hooks/useJSTDate';

function AssignPage() {
  const { formatDateTime, isToday } = useJSTDate();
  // ...
}
```

**テスト項目:**
- [ ] アサインメント一覧の日時表示
- [ ] 本日のアサインハイライト
- [ ] 通知送信時の時刻情報

---

### 🟡 P2: API エンドポイント

#### 6. `/app/api/attendance/punch/route.ts`
**現状の問題:**
- [ ] UTCタイムスタンプの生成処理
- [ ] QRトークンの有効期限判定

**修正方法:**
```typescript
import { toSupabaseTimestamp, isPast } from '@/lib/utils/date';

// QRトークン期限チェック
if (isPast(qrToken.expires_at)) {
  return NextResponse.json({ error: 'Token expired' }, { status: 401 });
}
```

**テスト項目:**
- [ ] 打刻時刻の正確な記録
- [ ] トークン期限の判定
- [ ] レスポンスのタイムゾーン情報

---

#### 7. `/app/api/assignments/today/route.ts`
**現状の問題:**
- [ ] 「今日」の判定処理
- [ ] シフト時間のフィルタリング

**修正方法:**
```typescript
import { isToday, getCurrentJST } from '@/lib/utils/date';

// 今日の日付でフィルタ
const todayStart = getCurrentJST('DATE') + 'T00:00:00';
const todayEnd = getCurrentJST('DATE') + 'T23:59:59';
```

**テスト項目:**
- [ ] 日付境界での正しい動作
- [ ] タイムゾーンを跨ぐ場合の処理

---

#### 8. `/app/api/admin/shifts/route.ts`
**現状の問題:**
- [ ] シフトデータの作成・更新時のタイムゾーン処理

**修正方法:**
```typescript
import { parseToUTC } from '@/lib/utils/date';

// JSTで送信された時刻をUTCに変換
const startUTC = parseToUTC(body.start_time);
const endUTC = parseToUTC(body.end_time);
```

---

### 🟢 P3: その他のコンポーネント

#### 9. `/app/admin/staff/page.tsx`
**現状の問題:**
- [ ] スタッフ情報の作成日時表示

**修正方法:**
```typescript
import { formatDate } from '@/lib/utils/date';

// 登録日の表示
<td>{formatDate(staff.created_at, 'DATE')}</td>
```

---

#### 10. `/app/admin/work-schedules/page.tsx`
**現状の問題:**
- [ ] 勤務予定の日時表示

**修正方法:**
```typescript
import { useJSTDate } from '@/hooks/useJSTDate';

const { formatDateTime } = useJSTDate();
```

---

## グローバル対応項目

### 共通コンポーネントの作成

- [ ] 日時表示用コンポーネント `<DateTime />`
- [ ] 日付ピッカーコンポーネント `<DatePicker />`
- [ ] 時刻ピッカーコンポーネント `<TimePicker />`
- [ ] 期間選択コンポーネント `<DateRangePicker />`

### APIレスポンスラッパーの実装

- [ ] `/lib/api/withTimezone.ts` の作成
- [ ] 全APIルートへの適用
- [ ] レスポンスへのタイムゾーンメタデータ付与

### テストの追加

- [ ] ユニットテスト: `/lib/utils/date.test.ts`
- [ ] 統合テスト: API エンドポイントのタイムゾーン処理
- [ ] E2Eテスト: 日時表示の正確性

---

## 移行手順

### Phase 1: 準備（1日）
1. [ ] `date-fns` と `date-fns-tz` のインストール完了
2. [ ] `/lib/utils/date.ts` の配置完了
3. [ ] `/hooks/useJSTDate.ts` の配置完了
4. [ ] 基本的なユニットテストの作成

### Phase 2: クリティカル対応（3日）
1. [ ] P0 項目の修正
2. [ ] 動作確認テスト
3. [ ] バグ修正

### Phase 3: 主要ページ対応（1週間）
1. [ ] P1 項目の修正
2. [ ] 統合テストの実行
3. [ ] コードレビュー

### Phase 4: API対応（3日）
1. [ ] P2 項目の修正
2. [ ] APIレスポンステスト
3. [ ] パフォーマンステスト

### Phase 5: 最終調整（2日）
1. [ ] P3 項目の修正
2. [ ] 全体テスト
3. [ ] ドキュメント更新
4. [ ] リリース準備

---

## 検証項目

### 機能テスト
- [ ] 打刻機能が正常に動作する
- [ ] 勤怠データが正しく記録される
- [ ] 管理画面で正しい時刻が表示される
- [ ] CSVエクスポートのデータが正しい

### 境界値テスト
- [ ] 日付境界（23:59 → 00:00）での動作
- [ ] 月末・月初での動作
- [ ] 年末・年始での動作
- [ ] サマータイム考慮（将来的な拡張性）

### パフォーマンステスト
- [ ] ページ読み込み速度の確認
- [ ] 大量データでの処理速度
- [ ] メモリ使用量の確認

### 互換性テスト
- [ ] 既存データとの互換性
- [ ] 外部システム連携の確認
- [ ] モバイルデバイスでの動作

---

## 完了基準

- [ ] 全てのP0, P1項目が完了
- [ ] テストカバレッジ80%以上
- [ ] パフォーマンステスト合格
- [ ] コードレビュー承認
- [ ] ドキュメント更新完了

---

## 注意事項

1. **データベースのタイムゾーン設定**
   - Supabase のタイムスタンプは UTC で保存
   - 表示時のみ JST に変換

2. **既存データへの影響**
   - 移行による既存データの変更はない
   - 表示層のみの変更

3. **ロールバック計画**
   - 各フェーズごとにロールバック可能
   - 旧実装はコメントアウトして保持（移行完了後に削除）

4. **モニタリング**
   - エラーログの監視
   - パフォーマンスメトリクスの確認
   - ユーザーフィードバックの収集

---

## 連絡先

問題や質問がある場合は、以下に連絡してください：
- テクニカルリード: [担当者名]
- プロジェクトマネージャー: [担当者名]

最終更新日: 2024-12-28