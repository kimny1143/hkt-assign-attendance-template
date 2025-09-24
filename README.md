# HAAS - HKT Assign & Attendance System

Next.js 14 (App Router) + Supabase (Postgres + PostGIS) によるスタッフアサイン＆勤怠管理システム。
**GPS±300m + 機材QRコード必須**の打刻、LINE/Slack webhook連携、管理画面を含む完全実装版。

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Supabaseの設定
1. Supabaseプロジェクトを作成
2. SQLエディタで以下の順番でマイグレーションを実行:
   - `supabase/migrations/complete_schema.sql` - 完全なスキーマ定義（テーブル、関数、ビュー）
   - 必要に応じて追加マイグレーション:
     - `001_add_postgis_distance_functions.sql` - PostGIS距離計算関数
     - `001b_add_geography_column.sql` - 地理情報カラム追加
     - `002_create_daily_assignments_view.sql` - 日次アサインビュー
     - `003_setup_rls_policies.sql` - RLSポリシー設定

### 3. 環境変数の設定
`.env.example`をコピーして`.env`を作成し、以下の値を設定:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Slack Integration (オプション)
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C1234567890  # 通知を送るチャンネルID

# App
APP_BASE_URL=http://localhost:3000
```

### 4. 開発サーバー起動
```bash
npm run dev
```

## 主要機能

### 認証・権限管理
- **ロールベースアクセス制御**: admin / manager / staff の3種類
- **自動リダイレクト**: ロールに応じて適切なページへ誘導
- **セキュア認証**: Supabase Auth統合

### スタッフ向け機能
- **打刻ページ** (`/punch`)
  - 機材QRコードスキャン
  - GPS位置情報による会場確認（±300m）
  - 写真撮影による本人確認
- **本日のアサイン確認**

### 管理者向け機能 (`/admin/*`)
- **ダッシュボード** (`/admin`)
  - 本日の勤怠状況一覧
  - 統計情報表示
- **スタッフ管理** (`/admin/staff`)
  - スタッフ登録・編集・削除
  - スキル管理
- **会場管理** (`/admin/venues`)
  - 会場情報登録（GPS座標含む）
  - 会場詳細編集
- **イベント管理** (`/admin/events-integrated`)
  - イベント・シフト統合管理
  - アサイン管理
- **機材管理** (`/admin/equipment`)
  - 機材QRコード登録
  - 機材配置管理
- **勤怠管理** (`/admin/attendance`)
  - リアルタイム勤怠確認
  - 勤怠記録修正

## API エンドポイント

### 認証API
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

### 勤怠API
- `POST /api/attendance/punch` - 打刻処理
- `POST /api/attendance/photo` - 写真アップロード
- `GET /api/assignments/today` - 本日のアサイン取得

### 管理API (`/api/admin/*`)
- `/api/admin/staff` - スタッフCRUD
- `/api/admin/events` - イベントCRUD
- `/api/admin/shifts` - シフトCRUD
- `/api/admin/assignments` - アサインCRUD
- `/api/admin/skills` - スキル管理

### Webhook
- `POST /api/slack-webhook` - Slack通知連携
- `POST /api/line-webhook` - LINE Bot連携（将来実装予定）

## データベース構成

### 主要テーブル
- `venues` - 会場情報（PostGIS geography型でGPS座標管理）
- `equipment` - 機材情報（物理QRコード）
- `events` - イベント情報
- `shifts` - シフト情報
- `staff` - スタッフ情報
- `skills` - スキルマスタ
- `staff_skills` - スタッフスキル紐付け
- `staff_schedules` - スタッフスケジュール
- `user_roles` - ユーザー権限（admin/manager/staff）
- `assignments` - アサイン情報
- `attendances` - 勤怠記録
- `qr_tokens` - 一時QRトークン
- `expenses` - 経費記録
- `audit_logs` - 監査ログ

### ビュー
- `v_payroll_monthly` - 月次給与計算用ビュー（freee向け）
- `v_daily_assignments` - 日次アサインメント表示用（マテリアライズドビュー）

## テスト

```bash
# ユニットテスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e

# すべてのテスト実行
npm run test:all
```

## MCP (Model Context Protocol) 統合

開発支援用のMCPサーバーが含まれています:
```bash
# MCP設定の検証
npm run mcp:validate

# 各種MCPサーバー起動
npm run mcp:start:playwright    # Playwright テスト
npm run mcp:start:supabase      # Supabase 操作
npm run mcp:start:github        # GitHub Actions
npm run mcp:start:jest          # Jest テスト
npm run mcp:start:navigation    # ナビゲーション
npm run mcp:start:build-dev     # ビルド・開発
npm run mcp:start:supabase-ops  # Supabase 運用
```

## 開発コマンド

```bash
# 開発サーバー
npm run dev

# ビルド
npm run build

# プロダクション起動
npm run start

# リント
npm run lint

# 型チェック
npm run type-check
```

## 物理QRコード運用

### 初期設定（管理者）
1. 機材にQRコードシールを貼付
2. 管理画面から機材情報を登録
3. QRコードと機材を紐付け

### 打刻フロー（スタッフ）
1. 現場到着時に機材QRコードをスキャン
2. GPS位置情報を自動取得
3. 会場から±300m以内であることを確認
4. 写真撮影で本人確認
5. 打刻完了

## セキュリティ考慮事項

- **サーバーサイドキー**: `SUPABASE_SERVICE_ROLE_KEY`はサーバー側のみで使用
- **RLSポリシー**: 適切な行レベルセキュリティ設定
- **Webhook検証**: Slack Webhookの署名検証実装済み
- **GPS検証**: PostGISによる正確な位置検証
- **監査ログ**: すべての重要操作を記録

## 注意事項

- PostGIS拡張が必須（GPS機能のため）
- Node.js 18以上推奨
- 本番環境では適切なバックアップ設定を行ってください
- Slack連携は環境変数設定が必要です