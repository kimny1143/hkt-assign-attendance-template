/**
 * JST日時処理用React Hook
 *
 * React コンポーネント内で日時処理を簡単に行うためのカスタムフック
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  formatToJST,
  formatDate,
  formatTime,
  formatDateTime,
  parseToJST,
  parseToUTC,
  getCurrentJST,
  toSupabaseTimestamp,
  calculateWorkHours,
  getTimeDifference,
  isToday,
  isPast,
  isFuture,
  getRelativeTime,
  DATE_FORMATS,
  type TimestampInput,
  type FormatOptions,
} from '@/lib/utils/date';

/**
 * Hook の戻り値の型定義
 */
export interface UseJSTDateReturn {
  // 基本フォーマット関数
  format: (timestamp: TimestampInput, options?: FormatOptions) => string;
  formatDate: (timestamp: TimestampInput, format?: keyof typeof DATE_FORMATS | string) => string;
  formatTime: (timestamp: TimestampInput, includeSeconds?: boolean) => string;
  formatDateTime: (timestamp: TimestampInput, options?: FormatOptions) => string;

  // 解析関数
  parseToJST: (timestamp: TimestampInput) => Date | null;
  parseToUTC: (timestamp: TimestampInput) => Date | null;

  // 現在時刻関連
  now: string;
  nowDate: Date;
  refreshNow: () => void;

  // ユーティリティ関数
  toSupabaseTimestamp: (jstDateString?: string) => string;
  calculateWorkHours: (checkIn: TimestampInput, checkOut: TimestampInput, format?: 'decimal' | 'hm' | 'japanese') => string;
  getTimeDifference: (start: TimestampInput, end: TimestampInput) => { milliseconds: number; minutes: number; hours: number } | null;

  // 判定関数
  isToday: (timestamp: TimestampInput) => boolean;
  isPast: (timestamp: TimestampInput) => boolean;
  isFuture: (timestamp: TimestampInput) => boolean;

  // 相対時間
  getRelativeTime: (timestamp: TimestampInput) => string;

  // リアルタイム更新用
  useRealtime: (enabled?: boolean) => void;
}

/**
 * Hook のオプション
 */
export interface UseJSTDateOptions {
  /**
   * リアルタイム更新を有効にするか（デフォルト: false）
   * 有効にすると、1分ごとに現在時刻が更新される
   */
  realtime?: boolean;

  /**
   * 更新間隔（ミリ秒）
   * realtimeがtrueの場合のみ有効
   */
  updateInterval?: number;

  /**
   * デフォルトのフォーマット
   */
  defaultFormat?: keyof typeof DATE_FORMATS | string;

  /**
   * デフォルトのフォールバック値
   */
  defaultFallback?: string;
}

/**
 * JST日時処理用カスタムHook
 *
 * @param options - Hook のオプション
 * @returns 日時処理用の関数群
 *
 * @example
 * ```typescript
 * // 基本的な使用方法
 * const { format, formatDate, formatTime } = useJSTDate();
 *
 * // リアルタイム更新を有効化
 * const { now, formatTime } = useJSTDate({ realtime: true });
 *
 * // カスタムオプション
 * const { format } = useJSTDate({
 *   defaultFormat: 'DATE_JP',
 *   defaultFallback: '未設定'
 * });
 * ```
 */
export function useJSTDate(options: UseJSTDateOptions = {}): UseJSTDateReturn {
  const {
    realtime = false,
    updateInterval = 60000, // 1分
    defaultFormat = 'DATETIME',
    defaultFallback = '-',
  } = options;

  // 現在時刻の管理
  const [nowDate, setNowDate] = useState<Date>(new Date());
  const [realtimeEnabled, setRealtimeEnabled] = useState(realtime);

  // 現在時刻の文字列表現（メモ化）
  const now = useMemo(
    () => getCurrentJST(defaultFormat),
    [nowDate, defaultFormat]
  );

  // 現在時刻を更新
  const refreshNow = useCallback(() => {
    setNowDate(new Date());
  }, []);

  // リアルタイム更新の制御
  const useRealtime = useCallback((enabled = true) => {
    setRealtimeEnabled(enabled);
  }, []);

  // リアルタイム更新の設定
  useEffect(() => {
    if (!realtimeEnabled) return;

    const interval = setInterval(() => {
      setNowDate(new Date());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [realtimeEnabled, updateInterval]);

  // フォーマット関数（デフォルト値を適用）
  const format = useCallback(
    (timestamp: TimestampInput, formatOptions?: FormatOptions) => {
      return formatToJST(timestamp, {
        format: defaultFormat,
        fallback: defaultFallback,
        ...formatOptions,
      });
    },
    [defaultFormat, defaultFallback]
  );

  // 日付フォーマット（メモ化）
  const formatDateMemo = useCallback(
    (timestamp: TimestampInput, formatPattern?: keyof typeof DATE_FORMATS | string) => {
      return formatDate(timestamp, formatPattern);
    },
    []
  );

  // 時刻フォーマット（メモ化）
  const formatTimeMemo = useCallback(
    (timestamp: TimestampInput, includeSeconds = false) => {
      return formatTime(timestamp, includeSeconds);
    },
    []
  );

  // 日時フォーマット（メモ化）
  const formatDateTimeMemo = useCallback(
    (timestamp: TimestampInput, formatOptions?: FormatOptions) => {
      return formatDateTime(timestamp, {
        fallback: defaultFallback,
        ...formatOptions,
      });
    },
    [defaultFallback]
  );

  // 戻り値
  return {
    // 基本フォーマット関数
    format,
    formatDate: formatDateMemo,
    formatTime: formatTimeMemo,
    formatDateTime: formatDateTimeMemo,

    // 解析関数
    parseToJST,
    parseToUTC,

    // 現在時刻関連
    now,
    nowDate,
    refreshNow,

    // ユーティリティ関数
    toSupabaseTimestamp,
    calculateWorkHours,
    getTimeDifference,

    // 判定関数
    isToday,
    isPast,
    isFuture,

    // 相対時間
    getRelativeTime,

    // リアルタイム更新用
    useRealtime,
  };
}

/**
 * 日時の入力と表示を管理するHook
 *
 * @param initialValue - 初期値
 * @param options - フォーマットオプション
 * @returns 入力管理用のオブジェクト
 *
 * @example
 * ```typescript
 * const dateInput = useJSTDateInput('2024-01-01T00:00:00Z');
 *
 * return (
 *   <input
 *     type="datetime-local"
 *     value={dateInput.inputValue}
 *     onChange={(e) => dateInput.setInputValue(e.target.value)}
 *   />
 * );
 * ```
 */
export function useJSTDateInput(
  initialValue?: TimestampInput,
  options: FormatOptions = {}
) {
  const [value, setValue] = useState<TimestampInput>(initialValue || null);

  // 入力用の値（YYYY-MM-DDTHH:mm 形式）
  const inputValue = useMemo(() => {
    const date = parseToJST(value);
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, [value]);

  // 表示用の値
  const displayValue = useMemo(() => {
    return formatToJST(value, options);
  }, [value, options]);

  // 入力値をセット（datetime-local からの入力を想定）
  const setInputValue = useCallback((newValue: string) => {
    if (!newValue) {
      setValue(null);
      return;
    }

    // "YYYY-MM-DDTHH:mm" 形式をJSTとして解釈してUTCに変換
    const jstDate = parseISO(newValue);
    const utcString = toSupabaseTimestamp(newValue);
    setValue(utcString);
  }, []);

  // 直接値をセット
  const setDirectValue = useCallback((newValue: TimestampInput) => {
    setValue(newValue);
  }, []);

  // クリア
  const clear = useCallback(() => {
    setValue(null);
  }, []);

  return {
    value,
    inputValue,
    displayValue,
    setInputValue,
    setValue: setDirectValue,
    clear,
  };
}

/**
 * 期間（開始・終了）を管理するHook
 *
 * @param initialStart - 初期開始時刻
 * @param initialEnd - 初期終了時刻
 * @returns 期間管理用のオブジェクト
 *
 * @example
 * ```typescript
 * const period = useJSTPeriod();
 *
 * // 勤務時間を計算
 * const workHours = period.duration('japanese');
 * // => "8時間30分"
 * ```
 */
export function useJSTPeriod(
  initialStart?: TimestampInput,
  initialEnd?: TimestampInput
) {
  const startDate = useJSTDateInput(initialStart);
  const endDate = useJSTDateInput(initialEnd);

  // 期間の妥当性をチェック
  const isValid = useMemo(() => {
    if (!startDate.value || !endDate.value) return false;

    const start = parseToJST(startDate.value);
    const end = parseToJST(endDate.value);

    if (!start || !end) return false;

    return start <= end;
  }, [startDate.value, endDate.value]);

  // 期間の長さを計算
  const duration = useCallback(
    (format: 'decimal' | 'hm' | 'japanese' = 'decimal') => {
      if (!startDate.value || !endDate.value) return '-';
      return calculateWorkHours(startDate.value, endDate.value, format);
    },
    [startDate.value, endDate.value]
  );

  // 期間の差分を取得
  const difference = useMemo(() => {
    if (!startDate.value || !endDate.value) return null;
    return getTimeDifference(startDate.value, endDate.value);
  }, [startDate.value, endDate.value]);

  // 開始と終了を入れ替え
  const swap = useCallback(() => {
    const temp = startDate.value;
    startDate.setValue(endDate.value);
    endDate.setValue(temp);
  }, [startDate, endDate]);

  // 両方クリア
  const clear = useCallback(() => {
    startDate.clear();
    endDate.clear();
  }, [startDate, endDate]);

  return {
    start: startDate,
    end: endDate,
    isValid,
    duration,
    difference,
    swap,
    clear,
  };
}

// parseISOは既に上部でインポート済み