/**
 * フォーマッター関数集
 *
 * 日付以外の各種データのフォーマット処理を提供
 */

/**
 * 数値を3桁カンマ区切りでフォーマット
 *
 * @param value - 数値
 * @returns フォーマット済み文字列
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (value == null) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ja-JP');
}

/**
 * 金額を円記号付きでフォーマット
 *
 * @param amount - 金額
 * @param showSign - 符号を表示するか
 * @returns フォーマット済み金額文字列
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  showSign = false
): string {
  if (amount == null) return '¥0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '¥0';

  const formatted = Math.abs(num).toLocaleString('ja-JP');
  const sign = showSign && num < 0 ? '-' : '';
  return `${sign}¥${formatted}`;
}

/**
 * 電話番号をフォーマット
 *
 * @param phoneNumber - 電話番号
 * @returns フォーマット済み電話番号
 *
 * @example
 * ```typescript
 * formatPhoneNumber('09012345678');
 * // => '090-1234-5678'
 *
 * formatPhoneNumber('0312345678');
 * // => '03-1234-5678'
 * ```
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '-';

  // 数字以外を除去
  const cleaned = phoneNumber.replace(/\D/g, '');

  // 携帯電話（11桁）
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }

  // 固定電話（10桁）
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // 市外局番が2桁の場合（東京03、大阪06など）
    if (['03', '06'].includes(cleaned.slice(0, 2))) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    // それ以外（3桁の市外局番）
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // フォーマットできない場合はそのまま返す
  return phoneNumber;
}

/**
 * 郵便番号をフォーマット
 *
 * @param postalCode - 郵便番号
 * @returns フォーマット済み郵便番号
 *
 * @example
 * ```typescript
 * formatPostalCode('1234567');
 * // => '123-4567'
 * ```
 */
export function formatPostalCode(postalCode: string | null | undefined): string {
  if (!postalCode) return '-';

  // 数字以外を除去
  const cleaned = postalCode.replace(/\D/g, '');

  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }

  return postalCode;
}

/**
 * スタッフコードをフォーマット
 *
 * @param code - スタッフコード
 * @param prefix - プレフィックス
 * @returns フォーマット済みスタッフコード
 *
 * @example
 * ```typescript
 * formatStaffCode('123');
 * // => 'S0123'
 * ```
 */
export function formatStaffCode(
  code: string | number | null | undefined,
  prefix = 'S'
): string {
  if (!code) return '-';
  const codeStr = code.toString().padStart(4, '0');
  return `${prefix}${codeStr}`;
}

/**
 * パーセンテージをフォーマット
 *
 * @param value - 値（0-1 または 0-100）
 * @param isDecimal - 0-1形式かどうか
 * @param decimals - 小数点以下の桁数
 * @returns フォーマット済みパーセンテージ
 */
export function formatPercentage(
  value: number | null | undefined,
  isDecimal = true,
  decimals = 1
): string {
  if (value == null) return '0%';

  const percentage = isDecimal ? value * 100 : value;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * ファイルサイズをフォーマット
 *
 * @param bytes - バイト数
 * @returns フォーマット済みサイズ
 *
 * @example
 * ```typescript
 * formatFileSize(1024);
 * // => '1.0 KB'
 *
 * formatFileSize(1048576);
 * // => '1.0 MB'
 * ```
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 座標を度分秒形式でフォーマット
 *
 * @param lat - 緯度
 * @param lon - 経度
 * @returns フォーマット済み座標
 */
export function formatCoordinates(
  lat: number | null | undefined,
  lon: number | null | undefined
): string {
  if (lat == null || lon == null) return '-';

  const formatDMS = (deg: number, isLat: boolean): string => {
    const absolute = Math.abs(deg);
    const d = Math.floor(absolute);
    const m = Math.floor((absolute - d) * 60);
    const s = Math.round(((absolute - d) * 60 - m) * 60);

    const direction = isLat
      ? deg >= 0 ? 'N' : 'S'
      : deg >= 0 ? 'E' : 'W';

    return `${d}°${m}'${s}"${direction}`;
  };

  return `${formatDMS(lat, true)} ${formatDMS(lon, false)}`;
}

/**
 * 座標を10進法でフォーマット
 *
 * @param lat - 緯度
 * @param lon - 経度
 * @param precision - 小数点以下の桁数
 * @returns フォーマット済み座標
 */
export function formatCoordinatesDecimal(
  lat: number | null | undefined,
  lon: number | null | undefined,
  precision = 6
): string {
  if (lat == null || lon == null) return '-';

  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * ステータスを日本語に変換
 *
 * @param status - ステータス文字列
 * @returns 日本語のステータス
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return '-';

  const statusMap: Record<string, string> = {
    // 勤怠ステータス
    'pending': '待機中',
    'working': '勤務中',
    'completed': '完了',
    'cancelled': 'キャンセル',

    // アサインステータス
    'assigned': 'アサイン済',
    'confirmed': '確認済',
    'declined': '辞退',

    // 一般的なステータス
    'active': 'アクティブ',
    'inactive': '非アクティブ',
    'draft': '下書き',
    'published': '公開',
    'archived': 'アーカイブ',
  };

  return statusMap[status.toLowerCase()] || status;
}

/**
 * 役職を日本語に変換
 *
 * @param role - 役職文字列
 * @returns 日本語の役職名
 */
export function formatRole(role: string | null | undefined): string {
  if (!role) return '-';

  const roleMap: Record<string, string> = {
    'lighting': '照明',
    'rigging': 'リギング',
    'sound': '音響',
    'stage': 'ステージ',
    'video': '映像',
    'admin': '管理者',
    'manager': 'マネージャー',
    'staff': 'スタッフ',
  };

  return roleMap[role.toLowerCase()] || role;
}

/**
 * 複数形の処理（日本語用カウンター）
 *
 * @param count - 数
 * @param unit - 単位
 * @returns カウンター付き文字列
 */
export function formatCount(count: number, unit: string): string {
  const counterMap: Record<string, string> = {
    '人': '人',
    '件': '件',
    '個': '個',
    '枚': '枚',
    '台': '台',
    '本': '本',
    '冊': '冊',
    '回': '回',
    '日': '日',
    '時間': '時間',
    '分': '分',
  };

  const counter = counterMap[unit] || unit;
  return `${count}${counter}`;
}

/**
 * 名前をイニシャルに変換
 *
 * @param name - 名前
 * @returns イニシャル
 *
 * @example
 * ```typescript
 * formatInitials('山田太郎');
 * // => 'YT'
 *
 * formatInitials('Taro Yamada');
 * // => 'TY'
 * ```
 */
export function formatInitials(name: string | null | undefined): string {
  if (!name) return '-';

  // 英語名の場合
  if (/^[A-Za-z\s]+$/.test(name)) {
    const parts = name.trim().split(/\s+/);
    return parts
      .map(part => part[0]?.toUpperCase())
      .filter(Boolean)
      .join('');
  }

  // 日本語名の場合（姓名の最初の文字）
  const trimmed = name.trim().replace(/\s+/g, '');
  if (trimmed.length >= 2) {
    return trimmed.slice(0, 2);
  }

  return trimmed[0] || '-';
}

/**
 * 住所を短縮形式でフォーマット
 *
 * @param address - 住所
 * @param maxLength - 最大文字数
 * @returns 短縮された住所
 */
export function formatAddressShort(
  address: string | null | undefined,
  maxLength = 20
): string {
  if (!address) return '-';

  if (address.length <= maxLength) return address;

  // 都道府県と市区町村を優先的に表示
  const prefectureMatch = address.match(/^(.{2,3}[都道府県])/);
  const cityMatch = address.match(/(.{2,5}[市区町村])/);

  if (prefectureMatch && cityMatch) {
    const base = prefectureMatch[1] + cityMatch[1];
    const remaining = maxLength - base.length - 3; // "..." の分
    if (remaining > 0) {
      const rest = address.slice(base.length);
      return base + rest.slice(0, remaining) + '...';
    }
    return base + '...';
  }

  return address.slice(0, maxLength - 3) + '...';
}

/**
 * ブール値を○×でフォーマット
 *
 * @param value - ブール値
 * @returns ○ または ×
 */
export function formatBoolean(value: boolean | null | undefined): string {
  if (value == null) return '-';
  return value ? '○' : '×';
}

/**
 * ブール値をYes/Noでフォーマット
 *
 * @param value - ブール値
 * @param japanese - 日本語表示
 * @returns Yes/No または はい/いいえ
 */
export function formatYesNo(
  value: boolean | null | undefined,
  japanese = true
): string {
  if (value == null) return '-';
  if (japanese) {
    return value ? 'はい' : 'いいえ';
  }
  return value ? 'Yes' : 'No';
}