# HKT スタッフアサイン＆勤怠 - テンプレリポ

Next.js(App Router) + Supabase(Postgres+PostGIS) の最小実装。  
**GPS±300m + QR + 写真(出退勤両方) 必須**の打刻、LINE webhook骨組み、freee向けCSVビューを含みます。

## セットアップ
1. 依存インストール
   ```bash
   npm i
   ```
2. Supabase プロジェクトを作成し、SQLエディタで `supabase/migrations/schema.sql` を実行。  
   - Storageに `att-photos` バケットを作成（RLSは運用設計に合わせて設定）。
3. `.env` を作成（`.env.example` をコピーして値を入れる）。
4. dev 起動
   ```bash
   npm run dev
   ```

## 主要URL
- 打刻デモ: `http://localhost:3000/punch`
- LINE Webhook: `POST /api/line-webhook` （チャンネル設定に登録、署名必須）
- 打刻API: `POST /api/attendance/punch`

## Supabase Edge Function
- 当日用QR生成: `supabase/functions/issue-qr/index.ts`  
  Supabase CLIがある場合:
  ```bash
  supabase functions deploy issue-qr
  supabase functions invoke issue-qr --no-verify-jwt --query 'shift_id=...&purpose=checkin'
  ```

## freee向けCSV（雛形）
- `public.v_payroll_monthly` ビューを期間で絞ってCSV出力してください。  
- 実運用では freeeのテンプレ列名に合わせ、管理UI側で列マッピングして出力する想定です。

## 注意
- このテンプレは最小構成です。StorageのRLSや署名URL流儀、管理UI、アサインの自動化、LIFFログイン等はプロジェクトで拡張してください。
- `SUPABASE_SERVICE_ROLE_KEY` は**サーバ側のみ**で使用してください（Edge Function/Server Route）。