# HAAS API リファレンスドキュメント
# HKT48劇場 スタッフアサイン＆勤怠システム - API リファレンス

## 目次
1. [概要](#概要)
2. [認証](#認証)
3. [共通レスポンス形式](#共通レスポンス形式)
4. [API エンドポイント](#api-エンドポイント)
   - [認証エンドポイント](#認証エンドポイント)
   - [勤怠エンドポイント](#勤怠エンドポイント)
   - [管理者エンドポイント](#管理者エンドポイント)
   - [スタッフエンドポイント](#スタッフエンドポイント)
   - [Webhook エンドポイント](#webhook-エンドポイント)
5. [エラーコード](#エラーコード)
6. [レート制限](#レート制限)

## 概要

HAAS API は、スタッフ、シフト、勤怠追跡を管理するための RESTful エンドポイントを提供します。すべての API リクエストは以下に送信してください：

**ベース URL**:
- 本番環境: `https://haas-nu.vercel.app/api`
- 開発環境: `http://localhost:3000/api`

**Content Type**: すべてのリクエストとレスポンスで `application/json` を使用

**認証**: ほとんどのエンドポイントでSupabase Auth経由のJWT認証が必要

## 認証

### 認証方法

API は Supabase Auth を通じた JWT ベース認証を使用します。トークンはセキュアな HTTP-only クッキーで管理されます。

```typescript
// Authentication flow
POST /api/auth/login
  → Returns: Sets auth cookie
  → Redirects to: /admin or appropriate page

GET /api/auth/me
  → Returns: Current user info
  → Requires: Valid auth cookie
```

### 必須ヘッダー

認証が必要なエンドポイントの場合:
```http
Cookie: sb-access-token=<jwt_token>
Content-Type: application/json
```

## 共通レスポンス形式

### 成功レスポンス
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### エラーレスポンス
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

### ページネーションレスポンス
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

## API エンドポイント

### 認証エンドポイント

#### POST /api/auth/login
ユーザーログインエンドポイント

**リクエストボディ:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

**ステータスコード:**
- `200`: ログイン成功
- `400`: 認証情報が無効
- `500`: サーバーエラー

---

#### POST /api/auth/logout
ユーザーログアウトエンドポイント

**リクエスト:** ボディ不要（クッキーを使用）

**レスポンス:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**ステータスコード:**
- `200`: ログアウト成功
- `401`: 認証されていません

---

#### GET /api/auth/me
現在のユーザー情報を取得

**レスポンス:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": {
      "name": "John Doe",
      "role": "admin"
    }
  }
}
```

**Status Codes:**
- `200`: 成功
- `401`: 認証されていません

### 勤怠エンドポイント

#### POST /api/attendance/punch
GPSとQR検証でチェックインまたはチェックアウト

**リクエストボディ:**
```json
{
  "equipment_qr": "QR_CODE_STRING",
  "lat": 33.5904,
  "lon": 130.4017,
  "purpose": "checkin" // or "checkout"
}
```

**検証ルール:**
- `equipment_qr`: 登録済み機材の有効なQRコード
- `lat`: 有効な緯度 (-90から90)
- `lon`: 有効な経度 (-180から180)
- GPSは会場から300m以内にある必要
- 機材がアクティブである必要

**レスポンス:**
```json
{
  "ok": true,
  "attendance": {
    "id": "uuid",
    "staff_id": "uuid",
    "shift_id": "uuid",
    "check_in": "2025-09-22T09:00:00Z",
    "check_out": null,
    "check_in_location": "POINT(130.4017 33.5904)",
    "equipment_qr": "QR_CODE_STRING"
  }
}
```

**ステータスコード:**
- `200`: パンチ成功
- `400`: 無効なQRコードまたはGPS範囲外
- `401`: 認証されていません
- `404`: 今日のシフトが見つかりません

**GPS距離計算:**
正確な距離計算にハバーサイン公式を使用:
```javascript
// 最大許可距離: 300メートル
// HKT48劇場座標: 33.5904, 130.4017
```

### 管理者エンドポイント

#### GET /api/admin/staff
すべてのスタッフメンバーを一覧表示

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `active` (optional): Filter by active status

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Staff Name",
      "email": "staff@example.com",
      "phone": "+81-90-1234-5678",
      "line_user_id": "U1234567890",
      "skills": ["PA", "sound_operator", "lighting", "backstage"],
      "active": true,
      "created_at": "2025-09-22T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Not authenticated
- `403`: Insufficient permissions

---

#### POST /api/admin/staff
Create a new staff member

**リクエストボディ:**
```json
{
  "email": "newstaff@example.com",
  "password": "password123",
  "name": "New Staff",
  "phone": "+81-90-1234-5678",
  "line_user_id": "U1234567890",
  "skills": ["PA", "sound_operator", "lighting", "backstage"],
  "proficiency_levels": {
    "PA": 3,
    "sound_operator": 4,
    "lighting": 5,
    "backstage": 2
  }
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "New Staff",
    "email": "newstaff@example.com",
    "created_at": "2025-09-22T00:00:00Z"
  }
}
```

**Status Codes:**
- `201`: Staff created
- `400`: Invalid input
- `401`: Not authenticated
- `403`: Insufficient permissions
- `409`: Email already exists

---

#### GET /api/admin/staff/[id]
Get specific staff member details

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Staff Name",
    "email": "staff@example.com",
    "phone": "+81-90-1234-5678",
    "line_user_id": "U1234567890",
    "skills": [
      {
        "id": "uuid",
        "name": "PA",
        "proficiency_level": 4,
        "is_certified": true
      }
    ],
    "attendance_records": [...],
    "assignments": [...]
  }
}
```

---

#### PUT /api/admin/staff/[id]
Update staff member information

**リクエストボディ:**
```json
{
  "name": "Updated Name",
  "phone": "+81-90-9876-5432",
  "skills": ["PA", "sound_operator", "lighting", "backstage"],
  "active": true
}
```

---

#### DELETE /api/admin/staff/[id]
Soft delete a staff member (sets active to false)

**レスポンス:**
```json
{
  "success": true,
  "message": "Staff member deactivated"
}
```

---

#### GET /api/admin/events
List all events

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "HKT48 Regular Performance",
      "venue": {
        "id": "uuid",
        "name": "HKT48 Theater",
        "lat": 33.5904,
        "lon": 130.4017
      },
      "date": "2025-09-22",
      "start_time": "18:00:00",
      "end_time": "21:00:00",
      "shifts": [...]
    }
  ]
}
```

---

#### GET /api/admin/shifts
List all shifts with assignment status

**Query Parameters:**
- `event_id` (optional): Filter by event
- `date` (optional): Filter by date (YYYY-MM-DD)
- `status` (optional): Filter by assignment status

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "event": {
        "id": "uuid",
        "name": "Event Name"
      },
      "skill_type": "PA",
      "start_ts": "2025-09-22T17:00:00Z",
      "end_ts": "2025-09-22T22:00:00Z",
      "required_count": 2,
      "assigned_count": 1,
      "assignments": [...]
    }
  ]
}
```

---

#### POST /api/admin/assign
Create shift assignments

**リクエストボディ:**
```json
{
  "shift_id": "uuid",
  "staff_ids": ["uuid1", "uuid2"],
  "notify": true
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "created": 2,
    "assignments": [
      {
        "id": "uuid",
        "shift_id": "uuid",
        "staff_id": "uuid",
        "status": "pending"
      }
    ]
  }
}
```

**Business Rules:**
- Cannot exceed required_count for shift
- Staff must have required skill
- No double-booking allowed
- Labor law compliance check

---

#### GET /api/admin/skills
List all available skills

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "PA",
      "category": "Technical",
      "description": "Public Address system operation"
    },
    {
      "id": "uuid",
      "name": "sound_operator",
      "category": "Technical",
      "description": "Sound mixing and control"
    },
    {
      "id": "uuid",
      "name": "lighting",
      "category": "Technical",
      "description": "Stage lighting operation"
    },
    {
      "id": "uuid",
      "name": "backstage",
      "category": "Support",
      "description": "Backstage support and coordination"
    }
  ]
}
```

### Staff Endpoints

#### GET /api/staff/schedule
Get current user's schedule

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "staff": {
      "id": "uuid",
      "name": "Staff Name"
    },
    "assignments": [
      {
        "id": "uuid",
        "shift": {
          "id": "uuid",
          "start_ts": "2025-09-22T17:00:00Z",
          "end_ts": "2025-09-22T22:00:00Z",
          "skill_type": "PA"
        },
        "event": {
          "name": "Regular Performance",
          "venue": "HKT48 Theater"
        },
        "status": "confirmed",
        "attendance": {
          "check_in": "2025-09-22T16:55:00Z",
          "check_out": null
        }
      }
    ]
  }
}
```

### Webhook Endpoints

#### POST /api/line-webhook
LINE Bot webhook for message handling

**Headers Required:**
```http
X-Line-Signature: <HMAC signature>
```

**リクエストボディ:**
```json
{
  "events": [
    {
      "type": "message",
      "replyToken": "token",
      "source": {
        "userId": "U1234567890",
        "type": "user"
      },
      "message": {
        "type": "text",
        "text": "CONFIRM"
      }
    }
  ]
}
```

**Supported Commands:**
- `CONFIRM`: Confirm shift assignment
- `DECLINE`: Decline shift assignment

**レスポンス:** `200 OK` (LINE requires 200 response)

**Security:** HMAC signature verification using LINE_CHANNEL_SECRET

---

#### POST /api/slack-webhook
Slack Bot webhook for notifications

**Headers Required:**
```http
X-Slack-Signature: <signature>
X-Slack-Request-Timestamp: <timestamp>
```

**リクエストボディ:**
```json
{
  "type": "event_callback",
  "event": {
    "type": "message",
    "text": "Assignment update",
    "user": "U123456",
    "channel": "C123456"
  }
}
```

**レスポンス:**
```json
{
  "ok": true
}
```

**Security:** Signature verification using SLACK_SIGNING_SECRET

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_REQUIRED` | Authentication required | 401 |
| `INVALID_CREDENTIALS` | Invalid email or password | 400 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `GPS_OUT_OF_RANGE` | GPS location too far from venue | 400 |
| `INVALID_QR_CODE` | QR code not recognized | 400 |
| `NO_SHIFT_FOUND` | No shift available for punch | 404 |
| `DUPLICATE_ENTRY` | Resource already exists | 409 |
| `LABOR_LAW_VIOLATION` | Exceeds labor law limits | 400 |
| `SERVER_ERROR` | Internal server error | 500 |

### Error Response Format
```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  }
}
```

## Rate Limiting

Currently, no rate limiting is implemented in the MVP stage. For production deployment, consider:

- **Authentication endpoints**: 5 requests per minute
- **API endpoints**: 100 requests per minute per user
- **Webhook endpoints**: 1000 requests per minute

### Recommended Implementation
```javascript
// Using express-rate-limit or similar
const rateLimiter = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later"
}
```

## Testing the API

### Using cURL

```bash
# Login
curl -X POST https://haas-nu.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user
curl https://haas-nu.vercel.app/api/auth/me \
  -H "Cookie: sb-access-token=<token>"

# Clock in
curl -X POST https://haas-nu.vercel.app/api/attendance/punch \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=<token>" \
  -d '{
    "equipment_qr":"QR123",
    "lat":33.5904,
    "lon":130.4017,
    "purpose":"checkin"
  }'
```

### Using JavaScript/TypeScript

```typescript
// Example using fetch
async function clockIn() {
  const response = await fetch('/api/attendance/punch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies
    body: JSON.stringify({
      equipment_qr: 'QR123',
      lat: 33.5904,
      lon: 130.4017,
      purpose: 'checkin'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}
```

## API Versioning

The API currently does not use versioning (MVP stage). For future releases:

- Version in URL path: `/api/v2/...`
- Version in header: `API-Version: 2`
- Deprecation notices: 3-month warning period

---

**ドキュメントバージョン**: 1.0.0
**最終更新**: 2025年9月22日
**状況**: MVP段階
**APIバージョン**: 1.0.0 (バージョン未管理)