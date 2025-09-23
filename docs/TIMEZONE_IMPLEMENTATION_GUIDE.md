# タイムゾーン処理実装ガイドライン

## 目次
1. [クイックスタート](#クイックスタート)
2. [基本的な使用方法](#基本的な使用方法)
3. [React コンポーネントでの使用](#react-コンポーネントでの使用)
4. [API での使用](#api-での使用)
5. [ベストプラクティス](#ベストプラクティス)
6. [アンチパターン](#アンチパターン)
7. [トラブルシューティング](#トラブルシューティング)

## クイックスタート

### インポート

```typescript
// ユーティリティ関数を使用する場合
import {
  formatToJST,
  formatDate,
  formatTime,
  formatDateTime,
  parseToJST,
  parseToUTC,
  toSupabaseTimestamp
} from '@/lib/utils/date';

// React Hook を使用する場合
import { useJSTDate } from '@/hooks/useJSTDate';

// フォーマッターを使用する場合
import { formatCurrency, formatPhoneNumber } from '@/lib/utils/formatters';
```

### 最も一般的な使用例

```typescript
// UTC タイムスタンプを JST で表示
const jstTime = formatToJST('2024-01-01T00:00:00Z');
// => '2024-01-01 09:00'

// 日付のみ表示
const jstDate = formatDate('2024-01-01T00:00:00Z');
// => '2024-01-01'

// 時刻のみ表示
const jstTimeOnly = formatTime('2024-01-01T00:00:00Z');
// => '09:00'

// Supabase へ保存する形式に変換
const utcTimestamp = toSupabaseTimestamp('2024-01-01 09:00');
// => '2024-01-01T00:00:00.000Z'
```

## 基本的な使用方法

### 1. 表示用フォーマット

```typescript
import { formatToJST, DATE_FORMATS } from '@/lib/utils/date';

// プリセットフォーマットを使用
formatToJST(timestamp, { format: 'DATE_JP' });
// => '2024年01月01日'

formatToJST(timestamp, { format: 'DATETIME_JP' });
// => '2024年01月01日 09:00'

// カスタムフォーマットを使用
formatToJST(timestamp, { format: 'yyyy/MM/dd (E)' });
// => '2024/01/01 (月)'

// フォールバック値を指定
formatToJST(null, { fallback: '未設定' });
// => '未設定'
```

### 2. 日付の解析

```typescript
import { parseToJST, parseToUTC } from '@/lib/utils/date';

// UTC → JST
const jstDate = parseToJST('2024-01-01T00:00:00Z');
console.log(jstDate); // Date object in JST

// JST → UTC
const utcDate = parseToUTC('2024-01-01 09:00:00');
console.log(utcDate); // Date object in UTC

// 様々な形式に対応
parseToJST('2024-01-01T00:00:00Z');      // ISO with Z
parseToJST('2024-01-01T00:00:00+00:00'); // ISO with offset
parseToJST('2024-01-01T00:00:00');       // ISO without TZ
parseToJST(new Date());                   // Date object
parseToJST(1704067200000);               // Unix timestamp
```

### 3. 勤務時間の計算

```typescript
import { calculateWorkHours } from '@/lib/utils/date';

const checkIn = '2024-01-01T00:00:00Z';
const checkOut = '2024-01-01T08:30:00Z';

// 10進数表記
calculateWorkHours(checkIn, checkOut);
// => '8.5'

// 時:分表記
calculateWorkHours(checkIn, checkOut, 'hm');
// => '8:30'

// 日本語表記
calculateWorkHours(checkIn, checkOut, 'japanese');
// => '8時間30分'
```

### 4. 日付の判定

```typescript
import { isToday, isPast, isFuture } from '@/lib/utils/date';

// 今日かどうか
if (isToday(eventDate)) {
  console.log('本日のイベントです');
}

// 過去かどうか
if (isPast(deadline)) {
  console.log('期限切れです');
}

// 未来かどうか
if (isFuture(startDate)) {
  console.log('まだ開始していません');
}
```

## React コンポーネントでの使用

### 基本的な Hook の使用

```typescript
'use client';

import { useJSTDate } from '@/hooks/useJSTDate';

export function EventCard({ event }) {
  const { formatDate, formatTime, isToday } = useJSTDate();

  return (
    <div className={isToday(event.date) ? 'bg-blue-100' : ''}>
      <h3>{formatDate(event.date, 'DATE_JP')}</h3>
      <p>開始: {formatTime(event.start_time)}</p>
      <p>終了: {formatTime(event.end_time)}</p>
    </div>
  );
}
```

### リアルタイム更新

```typescript
'use client';

import { useJSTDate } from '@/hooks/useJSTDate';

export function Clock() {
  // 1分ごとに自動更新
  const { now } = useJSTDate({
    realtime: true,
    updateInterval: 60000 // 1分
  });

  return <div>現在時刻: {now}</div>;
}
```

### 日時入力フォーム

```typescript
'use client';

import { useJSTDateInput } from '@/hooks/useJSTDate';

export function EventForm() {
  const startDate = useJSTDateInput();
  const endDate = useJSTDateInput();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Supabase用のUTC形式に変換済み
    const data = {
      start_ts: startDate.value,
      end_ts: endDate.value
    };

    await saveToDatabase(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="datetime-local"
        value={startDate.inputValue}
        onChange={(e) => startDate.setInputValue(e.target.value)}
      />
      <input
        type="datetime-local"
        value={endDate.inputValue}
        onChange={(e) => endDate.setInputValue(e.target.value)}
      />
      <button type="submit">保存</button>
    </form>
  );
}
```

### 期間の管理

```typescript
'use client';

import { useJSTPeriod } from '@/hooks/useJSTDate';

export function ShiftForm() {
  const shift = useJSTPeriod();

  return (
    <div>
      <input
        type="datetime-local"
        value={shift.start.inputValue}
        onChange={(e) => shift.start.setInputValue(e.target.value)}
      />
      <input
        type="datetime-local"
        value={shift.end.inputValue}
        onChange={(e) => shift.end.setInputValue(e.target.value)}
      />

      {shift.isValid && (
        <p>勤務時間: {shift.duration('japanese')}</p>
      )}

      {!shift.isValid && shift.start.value && shift.end.value && (
        <p className="text-red-500">終了時刻は開始時刻より後にしてください</p>
      )}
    </div>
  );
}
```

## API での使用

### API レスポンスの変換

```typescript
// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { formatToJST } from '@/lib/utils/date';

export async function GET() {
  const events = await getEventsFromDatabase();

  // レスポンスデータを変換
  const formattedEvents = events.map(event => ({
    ...event,
    // 表示用のJSTフィールドを追加
    event_date_display: formatToJST(event.event_date, { format: 'DATE_JP' }),
    start_time_display: formatTime(event.start_time),
    end_time_display: formatTime(event.end_time),
    // 元のUTCデータも保持
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time,
  }));

  return NextResponse.json({ events: formattedEvents });
}
```

### API リクエストの処理

```typescript
// app/api/attendance/punch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseToUTC } from '@/lib/utils/date';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // クライアントから送信されたJST時刻をUTCに変換
  const checkInUTC = parseToUTC(body.check_in_time);

  // Supabaseに保存
  const { data, error } = await supabase
    .from('attendances')
    .insert({
      check_in_ts: checkInUTC?.toISOString(),
      staff_id: body.staff_id,
      shift_id: body.shift_id
    });

  return NextResponse.json({ success: true });
}
```

### ミドルウェアパターン

```typescript
// lib/api/withTimezone.ts
import { formatToJST } from '@/lib/utils/date';

export function withTimezone(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    const response = await handler(req, ...args);

    if (response instanceof NextResponse) {
      const data = await response.json();

      // 自動的に日時フィールドを変換
      const transformed = transformDates(data);

      return NextResponse.json(transformed);
    }

    return response;
  };
}

function transformDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof Date) {
    return formatToJST(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(transformDates);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      // タイムスタンプっぽいフィールドを自動変換
      if (key.endsWith('_at') || key.endsWith('_ts')) {
        result[key] = obj[key];
        result[`${key}_jst`] = formatToJST(obj[key]);
      } else {
        result[key] = transformDates(obj[key]);
      }
    }
    return result;
  }

  return obj;
}
```

## ベストプラクティス

### 1. 一貫性のある命名規則

```typescript
// ✅ 良い例：明確な命名
const checkInTimeJST = formatToJST(data.check_in_ts);
const checkInTimeDisplay = formatTime(data.check_in_ts);
const checkInDateISO = toSupabaseTimestamp(checkInInput);

// ❌ 悪い例：曖昧な命名
const time = formatToJST(data.check_in_ts);
const checkIn = formatTime(data.check_in_ts);
```

### 2. 早期変換・遅延フォーマット

```typescript
// ✅ 良い例：表示の直前でフォーマット
function EventList({ events }) {
  return events.map(event => (
    <div key={event.id}>
      {/* 表示時にフォーマット */}
      <span>{formatDate(event.event_date)}</span>
    </div>
  ));
}

// ❌ 悪い例：データ取得時に変換
async function getEvents() {
  const events = await fetchEvents();
  // 早すぎる変換は避ける
  return events.map(e => ({
    ...e,
    date: formatDate(e.event_date) // 文字列になってしまう
  }));
}
```

### 3. null/undefined の適切な処理

```typescript
// ✅ 良い例：フォールバックを活用
const displayTime = formatToJST(data.timestamp, {
  fallback: '未設定'
});

// ✅ 良い例：条件付きレンダリング
{data.check_out_ts && (
  <span>退勤: {formatTime(data.check_out_ts)}</span>
)}

// ❌ 悪い例：null チェックなし
const time = formatTime(data.might_be_null); // エラーの可能性
```

### 4. パフォーマンスの考慮

```typescript
// ✅ 良い例：メモ化を活用
const EventCard = React.memo(({ event }) => {
  const formattedDate = useMemo(
    () => formatDate(event.date, 'DATE_JP'),
    [event.date]
  );

  return <div>{formattedDate}</div>;
});

// ✅ 良い例：Hook を活用
function EventList() {
  const { formatDate } = useJSTDate(); // メモ化済み
  // ...
}
```

### 5. タイムゾーン情報の保持

```typescript
// ✅ 良い例：元データとフォーマット済みデータを両方保持
interface Event {
  start_ts: string;        // UTC (データベース用)
  start_ts_display?: string; // JST (表示用)
}

// ✅ 良い例：メタデータを付与
interface ApiResponse {
  data: any;
  timezone: 'Asia/Tokyo';
  formatted_at: string;
}
```

## アンチパターン

### 1. ❌ ネイティブ Date の直接使用

```typescript
// ❌ 悪い例
const date = new Date(timestamp);
const formatted = date.toLocaleString('ja-JP');

// ✅ 良い例
const formatted = formatToJST(timestamp);
```

### 2. ❌ 手動でのタイムゾーンオフセット計算

```typescript
// ❌ 悪い例
const jstTime = new Date(utcTime.getTime() + 9 * 60 * 60 * 1000);

// ✅ 良い例
const jstTime = parseToJST(utcTime);
```

### 3. ❌ 正規表現での時刻抽出

```typescript
// ❌ 悪い例
const timeMatch = dateStr.match(/T(\d{2}):(\d{2})/);
const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '';

// ✅ 良い例
const time = formatTime(dateStr);
```

### 4. ❌ 文字列結合での日時生成

```typescript
// ❌ 悪い例
const datetime = `${date}T${time}:00`;

// ✅ 良い例
const datetime = toSupabaseTimestamp(`${date} ${time}`);
```

### 5. ❌ グローバルな日時設定の変更

```typescript
// ❌ 悪い例
Date.prototype.toJSON = function() {
  // タイムゾーンを勝手に変更
};

// ✅ 良い例
// ユーティリティ関数を使用
```

## トラブルシューティング

### 問題: 表示時刻が9時間ずれる

**原因**: UTC と JST の変換ミス

```typescript
// 診断
console.log('Raw:', timestamp);
console.log('Parsed:', parseToJST(timestamp));
console.log('Formatted:', formatToJST(timestamp));

// 解決
const correctTime = formatToJST(timestamp); // 自動でUTC→JST変換
```

### 問題: datetime-local input の値が表示されない

**原因**: フォーマットの不一致

```typescript
// ❌ 悪い例
<input type="datetime-local" value={formatToJST(date)} />

// ✅ 良い例
const dateInput = useJSTDateInput(date);
<input type="datetime-local" value={dateInput.inputValue} />
```

### 問題: Supabase への保存でエラー

**原因**: タイムスタンプ形式の不一致

```typescript
// ❌ 悪い例
await supabase.insert({
  timestamp: '2024-01-01 09:00' // JSTのまま
});

// ✅ 良い例
await supabase.insert({
  timestamp: toSupabaseTimestamp('2024-01-01 09:00')
});
```

### 問題: time 型フィールドの処理

**原因**: time 型は日付情報を持たない

```typescript
// Supabase の time 型への対応
function handleTimeField(timeValue: string) {
  // "HH:mm:ss" 形式の場合
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
    return timeValue.substring(0, 5); // "HH:mm"
  }
  // タイムスタンプの場合
  return formatTime(timeValue);
}
```

### 問題: テストでの日時モック

```typescript
// Jest でのモック例
import { formatToJST } from '@/lib/utils/date';

jest.mock('@/lib/utils/date', () => ({
  ...jest.requireActual('@/lib/utils/date'),
  getCurrentJST: jest.fn(() => '2024-01-01 09:00'),
}));

// テスト
test('displays current time', () => {
  const result = getCurrentJST();
  expect(result).toBe('2024-01-01 09:00');
});
```

## 移行ガイド

### 既存コードからの移行

```typescript
// 移行前
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo'
  });
};

// 移行後
import { formatTime } from '@/lib/utils/date';
// 使用方法は同じ
```

### 段階的移行の推奨手順

1. **準備フェーズ**
   ```bash
   npm install date-fns date-fns-tz
   ```

2. **ユーティリティの配置**
   - `/lib/utils/date.ts` をプロジェクトに追加
   - `/hooks/useJSTDate.ts` を追加

3. **新規コードでの採用**
   - 新しいコンポーネントから使用開始
   - コードレビューでの確認

4. **既存コードの移行**
   - 重要度の高いページから順次移行
   - テストの追加

5. **古いコードの削除**
   - 使用されていない関数の削除
   - リファクタリング

## まとめ

このガイドラインに従うことで：

- ✅ 一貫性のあるタイムゾーン処理
- ✅ バグの削減
- ✅ コードの可読性向上
- ✅ メンテナンスの容易化
- ✅ パフォーマンスの最適化

質問や問題がある場合は、チームメンバーに相談してください。