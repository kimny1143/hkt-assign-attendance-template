/**
 * 日付・時刻処理ユーティリティ
 *
 * このモジュールは、HaaSシステム全体で使用される日付・時刻の変換と
 * フォーマット処理を提供します。
 *
 * 主な機能:
 * - UTC/JST間の変換
 * - Supabaseタイムスタンプの解析
 * - 各種表示フォーマットへの変換
 */

import { format, parse, parseISO, isValid } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// タイムゾーン定数
export const TIMEZONE_JST = 'Asia/Tokyo';
export const TIMEZONE_UTC = 'UTC';

// よく使うフォーマットパターン
export const DATE_FORMATS = {
  // 日付のみ
  DATE: 'yyyy-MM-dd',
  DATE_JP: 'yyyy年MM月dd日',
  DATE_SLASH: 'yyyy/MM/dd',

  // 時刻のみ
  TIME: 'HH:mm',
  TIME_WITH_SEC: 'HH:mm:ss',

  // 日付と時刻
  DATETIME: 'yyyy-MM-dd HH:mm',
  DATETIME_JP: 'yyyy年MM月dd日 HH:mm',
  DATETIME_WITH_SEC: 'yyyy-MM-dd HH:mm:ss',

  // ISO形式
  ISO: "yyyy-MM-dd'T'HH:mm:ssXXX",
  ISO_WITHOUT_TZ: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

/**
 * タイムスタンプ型の定義
 * Supabaseから返される可能性のある形式
 */
export type TimestampInput =
  | string
  | Date
  | number
  | null
  | undefined;

/**
 * フォーマットオプション
 */
export interface FormatOptions {
  format?: keyof typeof DATE_FORMATS | string;
  timezone?: string;
  fallback?: string;
}

/**
 * UTC文字列をJSTのDateオブジェクトに変換
 *
 * @param timestamp - UTC タイムスタンプ
 * @returns JST の Date オブジェクト、無効な場合は null
 *
 * @example
 * ```typescript
 * const utc = '2024-01-01T00:00:00Z';
 * const jstDate = parseToJST(utc);
 * // => 2024-01-01 09:00:00 JST
 * ```
 */
export function parseToJST(timestamp: TimestampInput): Date | null {
  if (!timestamp) return null;

  try {
    let date: Date;

    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      // ISO形式の日付文字列を解析
      date = parseISO(timestamp);

      // 無効な日付の場合、別のフォーマットを試す
      if (!isValid(date)) {
        // "HH:mm:ss" 形式の時刻のみの場合、今日の日付を付与
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(timestamp)) {
          const today = format(new Date(), 'yyyy-MM-dd');
          date = parseISO(`${today}T${timestamp}`);
        } else {
          return null;
        }
      }
    } else {
      return null;
    }

    if (!isValid(date)) return null;

    // UTC → JST 変換
    return toZonedTime(date, TIMEZONE_JST);
  } catch (error) {
    console.error('Date parsing error:', error, 'Input:', timestamp);
    return null;
  }
}

/**
 * JST文字列をUTCのDateオブジェクトに変換
 *
 * @param timestamp - JST タイムスタンプ
 * @returns UTC の Date オブジェクト、無効な場合は null
 *
 * @example
 * ```typescript
 * const jst = '2024-01-01 09:00:00';
 * const utcDate = parseToUTC(jst);
 * // => 2024-01-01T00:00:00Z
 * ```
 */
export function parseToUTC(timestamp: TimestampInput): Date | null {
  if (!timestamp) return null;

  try {
    let date: Date;

    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      // タイムゾーン情報がない場合、JSTとして解釈
      if (!timestamp.includes('T') || !timestamp.match(/[+-]\d{2}:\d{2}|Z$/)) {
        // "YYYY-MM-DD HH:mm:ss" → ISO形式に変換
        const isoString = timestamp.replace(' ', 'T');
        date = parseISO(isoString);
        // JSTとして解釈してUTCに変換
        return fromZonedTime(date, TIMEZONE_JST);
      } else {
        date = parseISO(timestamp);
      }
    } else {
      return null;
    }

    if (!isValid(date)) return null;

    return date;
  } catch (error) {
    console.error('Date parsing error:', error, 'Input:', timestamp);
    return null;
  }
}

/**
 * タイムスタンプをJST表示用にフォーマット
 *
 * @param timestamp - 入力タイムスタンプ（UTC想定）
 * @param options - フォーマットオプション
 * @returns フォーマット済み文字列
 *
 * @example
 * ```typescript
 * const utc = '2024-01-01T00:00:00Z';
 *
 * formatToJST(utc);
 * // => '2024-01-01 09:00'
 *
 * formatToJST(utc, { format: 'DATE_JP' });
 * // => '2024年01月01日'
 *
 * formatToJST(utc, { format: 'HH:mm' });
 * // => '09:00'
 *
 * formatToJST(null, { fallback: '未設定' });
 * // => '未設定'
 * ```
 */
export function formatToJST(
  timestamp: TimestampInput,
  options: FormatOptions = {}
): string {
  const {
    format: formatPattern = 'DATETIME',
    fallback = '-'
  } = options;

  if (!timestamp) return fallback;

  try {
    const jstDate = parseToJST(timestamp);
    if (!jstDate) return fallback;

    // DATE_FORMATS から取得、なければそのまま使用
    const pattern = DATE_FORMATS[formatPattern as keyof typeof DATE_FORMATS] || formatPattern;

    return formatInTimeZone(jstDate, TIMEZONE_JST, pattern);
  } catch (error) {
    console.error('Formatting error:', error, 'Input:', timestamp);
    return fallback;
  }
}

/**
 * 日付部分のみを抽出してフォーマット（JST）
 *
 * @param timestamp - 入力タイムスタンプ
 * @param formatPattern - フォーマットパターン
 * @returns フォーマット済み日付文字列
 *
 * @example
 * ```typescript
 * formatDate('2024-01-01T15:30:00Z');
 * // => '2024-01-02' (JSTで翌日になる場合)
 *
 * formatDate('2024-01-01T15:30:00Z', 'DATE_JP');
 * // => '2024年01月02日'
 * ```
 */
export function formatDate(
  timestamp: TimestampInput,
  formatPattern: keyof typeof DATE_FORMATS | string = 'DATE'
): string {
  return formatToJST(timestamp, { format: formatPattern });
}

/**
 * 時刻部分のみを抽出してフォーマット（JST）
 *
 * @param timestamp - 入力タイムスタンプ
 * @param includeSeconds - 秒を含めるかどうか
 * @returns フォーマット済み時刻文字列
 *
 * @example
 * ```typescript
 * formatTime('2024-01-01T00:00:00Z');
 * // => '09:00'
 *
 * formatTime('2024-01-01T00:00:00Z', true);
 * // => '09:00:00'
 *
 * formatTime('15:30:00');
 * // => '15:30'
 * ```
 */
export function formatTime(
  timestamp: TimestampInput,
  includeSeconds = false
): string {
  // time型（"HH:mm:ss"形式）の処理
  if (typeof timestamp === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timestamp)) {
    return includeSeconds ? timestamp : timestamp.substring(0, 5);
  }

  return formatToJST(timestamp, {
    format: includeSeconds ? 'TIME_WITH_SEC' : 'TIME',
    fallback: '-'
  });
}

/**
 * 日時を指定フォーマットで表示（JST）
 *
 * @param timestamp - 入力タイムスタンプ
 * @param options - フォーマットオプション
 * @returns フォーマット済み日時文字列
 *
 * @example
 * ```typescript
 * formatDateTime('2024-01-01T00:00:00Z');
 * // => '2024-01-01 09:00'
 *
 * formatDateTime('2024-01-01T00:00:00Z', { format: 'DATETIME_JP' });
 * // => '2024年01月01日 09:00'
 * ```
 */
export function formatDateTime(
  timestamp: TimestampInput,
  options: FormatOptions = {}
): string {
  return formatToJST(timestamp, {
    format: 'DATETIME',
    ...options
  });
}

/**
 * 現在時刻をJSTで取得
 *
 * @param formatPattern - フォーマットパターン
 * @returns 現在時刻の文字列
 *
 * @example
 * ```typescript
 * getCurrentJST();
 * // => '2024-01-01 09:00'
 *
 * getCurrentJST('DATE');
 * // => '2024-01-01'
 * ```
 */
export function getCurrentJST(
  formatPattern: keyof typeof DATE_FORMATS | string = 'DATETIME'
): string {
  return formatToJST(new Date(), { format: formatPattern });
}

/**
 * Supabase用のタイムスタンプを生成（UTC ISO形式）
 *
 * @param jstDateString - JST日時文字列（省略時は現在時刻）
 * @returns UTC ISO形式の文字列
 *
 * @example
 * ```typescript
 * toSupabaseTimestamp('2024-01-01 09:00');
 * // => '2024-01-01T00:00:00.000Z'
 *
 * toSupabaseTimestamp();
 * // => '2024-01-01T00:00:00.000Z' (現在時刻)
 * ```
 */
export function toSupabaseTimestamp(jstDateString?: string): string {
  const date = jstDateString
    ? fromZonedTime(parseISO(jstDateString.replace(' ', 'T')), TIMEZONE_JST)
    : new Date();

  return date.toISOString();
}

/**
 * 2つの日時の差を計算（ミリ秒、分、時間）
 *
 * @param start - 開始時刻
 * @param end - 終了時刻
 * @returns 時間差のオブジェクト
 *
 * @example
 * ```typescript
 * const diff = getTimeDifference('2024-01-01T00:00:00Z', '2024-01-01T09:00:00Z');
 * // => { milliseconds: 32400000, minutes: 540, hours: 9 }
 * ```
 */
export function getTimeDifference(
  start: TimestampInput,
  end: TimestampInput
): { milliseconds: number; minutes: number; hours: number } | null {
  const startDate = parseToJST(start);
  const endDate = parseToJST(end);

  if (!startDate || !endDate) return null;

  const milliseconds = endDate.getTime() - startDate.getTime();
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);

  return { milliseconds, minutes, hours };
}

/**
 * 勤務時間を計算してフォーマット
 *
 * @param checkIn - 出勤時刻
 * @param checkOut - 退勤時刻
 * @param format - 出力形式（'decimal' | 'hm' | 'japanese'）
 * @returns フォーマット済み勤務時間
 *
 * @example
 * ```typescript
 * calculateWorkHours('2024-01-01T00:00:00Z', '2024-01-01T08:30:00Z');
 * // => '8.5'
 *
 * calculateWorkHours('2024-01-01T00:00:00Z', '2024-01-01T08:30:00Z', 'hm');
 * // => '8:30'
 *
 * calculateWorkHours('2024-01-01T00:00:00Z', '2024-01-01T08:30:00Z', 'japanese');
 * // => '8時間30分'
 * ```
 */
export function calculateWorkHours(
  checkIn: TimestampInput,
  checkOut: TimestampInput,
  format: 'decimal' | 'hm' | 'japanese' = 'decimal'
): string {
  const diff = getTimeDifference(checkIn, checkOut);
  if (!diff) return '-';

  const { hours, minutes } = diff;
  const remainingMinutes = minutes % 60;

  switch (format) {
    case 'decimal':
      return (minutes / 60).toFixed(1);
    case 'hm':
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
    case 'japanese':
      return remainingMinutes > 0
        ? `${hours}時間${remainingMinutes}分`
        : `${hours}時間`;
    default:
      return '-';
  }
}

/**
 * 日付が今日かどうかを判定（JST基準）
 *
 * @param timestamp - 判定対象の日時
 * @returns 今日かどうか
 */
export function isToday(timestamp: TimestampInput): boolean {
  const targetDate = parseToJST(timestamp);
  if (!targetDate) return false;

  const today = toZonedTime(new Date(), TIMEZONE_JST);

  return (
    targetDate.getFullYear() === today.getFullYear() &&
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getDate() === today.getDate()
  );
}

/**
 * 日付が過去かどうかを判定（JST基準）
 *
 * @param timestamp - 判定対象の日時
 * @returns 過去かどうか
 */
export function isPast(timestamp: TimestampInput): boolean {
  const targetDate = parseToJST(timestamp);
  if (!targetDate) return false;

  const now = toZonedTime(new Date(), TIMEZONE_JST);
  return targetDate < now;
}

/**
 * 日付が未来かどうかを判定（JST基準）
 *
 * @param timestamp - 判定対象の日時
 * @returns 未来かどうか
 */
export function isFuture(timestamp: TimestampInput): boolean {
  const targetDate = parseToJST(timestamp);
  if (!targetDate) return false;

  const now = toZonedTime(new Date(), TIMEZONE_JST);
  return targetDate > now;
}

/**
 * 相対的な時間表示（例: 2時間前、3日後）
 *
 * @param timestamp - 対象の日時
 * @returns 相対時間の文字列
 *
 * @example
 * ```typescript
 * getRelativeTime('2024-01-01T00:00:00Z');
 * // => '2時間前' または '3日後' など
 * ```
 */
export function getRelativeTime(timestamp: TimestampInput): string {
  const targetDate = parseToJST(timestamp);
  if (!targetDate) return '-';

  const now = toZonedTime(new Date(), TIMEZONE_JST);
  const diffMs = targetDate.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);

  const minutes = Math.floor(absDiffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const suffix = diffMs < 0 ? '前' : '後';

  if (days > 0) return `${days}日${suffix}`;
  if (hours > 0) return `${hours}時間${suffix}`;
  if (minutes > 0) return `${minutes}分${suffix}`;
  return '今';
}

// FormatOptionsはすでに上部でエクスポート済み