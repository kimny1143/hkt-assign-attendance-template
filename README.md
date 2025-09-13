# HKT スタッフアサイン＆勤怠 - テンプレリポ

Next.js(App Router) + Supabase(Postgres+PostGIS) の最小実装。  
**GPS±300m + 機材QRコード必須**の打刻、LINE webhook骨組み、freee向けCSVビューを含みます。

## セットアップ
1. 依存インストール
   ```bash
   npm i
   ```
2. Supabase プロジェクトを作成し、SQLエディタで `supabase/migrations/schema.sql` を実行。
3. `.env` を作成（`.env.example` をコピーして値を入れる）。
4. dev 起動
   ```bash
   npm run dev
   ```

## 主要URL
- 打刻デモ: `http://localhost:3000/punch`
- LINE Webhook: `POST /api/line-webhook` （チャンネル設定に登録、署名必須）
- 打刻API: `POST /api/attendance/punch`

## 物理QRコード運用
1. **初期設定（管理者）**
   - 機材にQRコードシールを貼付
   - `equipment`テーブルに機材情報を登録
   ```sql
   INSERT INTO equipment (venue_id, name, qr_code, equipment_type, location_hint)
   VALUES ('venue-uuid', '照明機材A', 'LIGHT-001-XYZ', 'lighting', 'ステージ左袖');
   ```

2. **打刻フロー（スタッフ）**
   - 現場の機材QRコードをスキャン
   - GPS位置情報を自動取得
   - 会場から±300m以内なら打刻成功

## データベース構成
- `venues`: 会場情報（GPS座標）
- `equipment`: 機材情報（物理QRコード）
- `events`: イベント情報
- `shifts`: シフト情報
- `staff`: スタッフ情報
- `user_roles`: ユーザー権限（admin/manager/staff）
- `assignments`: アサイン情報
- `attendances`: 勤怠記録

## freee向けCSV（雛形）
- `public.v_payroll_monthly` ビューを期間で絞ってCSV出力してください。  
- 実運用では freeeのテンプレ列名に合わせ、管理UI側で列マッピングして出力する想定です。

## 注意
- このテンプレは最小構成です。管理UI、アサインの自動化、LIFFログイン等はプロジェクトで拡張してください。
- `SUPABASE_SERVICE_ROLE_KEY` は**サーバ側のみ**で使用してください（Edge Function/Server Route）。