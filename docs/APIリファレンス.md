# APIリファレンス

## 概要

HAASSスタッフ管理・出退勤システムのAPI仕様書です。

## エンドポイント一覧

### 認証 (Auth)

#### POST `/api/auth/login`
ユーザーログイン

**リクエストボディ**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "staff"
  }
}
```

---

### 出退勤 (Attendance)

#### POST `/api/attendance/punch`
出勤・退勤打刻（GPS検証付き）

**リクエストボディ**
```json
{
  "equipment_qr": "QR-CODE-STRING",
  "lat": 35.6762,
  "lon": 139.6503,
  "purpose": "checkin" | "checkout"
}
```

**検証ルール**
- GPS位置が会場から300m以内であること
- QRコードが有効であること
- 当日のシフトが存在すること

**レスポンス**
```json
{
  "ok": true,
  "attendance": {
    "id": "uuid",
    "check_in_at": "2024-09-23T09:00:00Z",
    "check_out_at": null
  }
}
```

---

### シフト管理 (Shifts)

#### GET `/api/assignments/today`
本日の割り当て取得（JST基準）

**レスポンス**
```json
{
  "assignments": [
    {
      "id": "uuid",
      "status": "confirmed",
      "shifts": {
        "start_at": "2024-09-23T09:00:00Z",
        "end_at": "2024-09-23T18:00:00Z",
        "events": {
          "name": "イベント名",
          "venues": {
            "name": "会場名",
            "address": "住所"
          }
        }
      }
    }
  ]
}
```

#### GET `/api/staff/schedule`
週間スケジュール取得

**クエリパラメータ**
- `week_start`: 週の開始日（YYYY-MM-DD）

**レスポンス**
```json
{
  "schedule": {
    "monday": true,
    "tuesday": false,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "total_hours": 32
  }
}
```

---

### 管理者API (Admin)

#### GET `/api/admin/staff`
スタッフ一覧取得

**レスポンス**
```json
{
  "staff": [
    {
      "id": "uuid",
      "name": "山田太郎",
      "email": "yamada@example.com",
      "skills": {
        "PA": true,
        "音源再生": false,
        "照明": true,
        "バックヤード": false
      },
      "weekly_hours": 32
    }
  ]
}
```

#### POST `/api/admin/assign`
スタッフ割り当て作成

**リクエストボディ**
```json
{
  "shift_id": "uuid",
  "staff_id": "uuid",
  "skill_type": "PA"
}
```

**ビジネスルール**
- 週40時間制限のチェック
- スキル要件の確認
- 重複割り当ての防止

---

### LINE連携

#### POST `/api/line-webhook`
LINE Webhookエンドポイント

**処理内容**
- HMAC署名検証
- CONFIRM/DECLINE コマンドの処理
- 割り当て確認通知の送信

---

### ヘルスチェック

#### GET `/api/health`
システム稼働状況確認

**レスポンス**
```json
{
  "status": "ok",
  "timestamp": "2024-09-23T00:00:00.000Z",
  "environment": "production",
  "uptime": 3600
}
```

---

## エラーレスポンス

### 共通エラー形式
```json
{
  "error": "エラーメッセージ",
  "details": "詳細情報",
  "code": "ERROR_CODE"
}
```

### HTTPステータスコード
- `200` - 成功
- `400` - 不正なリクエスト
- `401` - 認証エラー
- `403` - 権限なし
- `404` - リソース未発見
- `500` - サーバーエラー

## 認証

すべてのAPIエンドポイント（ヘルスチェックとWebhook除く）はSupabase認証が必要です。

```javascript
// クライアント側の認証ヘッダー例
headers: {
  'Authorization': 'Bearer YOUR_SESSION_TOKEN'
}
```

## レート制限

- 通常API: 100リクエスト/分
- 出勤打刻API: 10リクエスト/分
- 管理者API: 50リクエスト/分