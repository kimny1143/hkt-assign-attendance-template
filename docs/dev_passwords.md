# 開発環境用パスワード管理

## 問題
Supabase Authは無効なメールドメイン（`@haas.test`など）を拒否するため、テストアカウントでパスワード設定ができない。

## 解決策

### 方法1: 有効なメールアドレスを使用（推奨）
テスト用に以下のような有効なメールアドレスを使用：
- `test+1@example.com`
- `test+2@example.com`
- 実際のGmailアドレス + エイリアス（`youremail+test1@gmail.com`）

### 方法2: ローカルパスワード管理
Supabase Authを使わず、別テーブルでパスワードを管理（開発環境のみ）

### 方法3: Supabaseダッシュボードで手動作成
1. Supabaseダッシュボード → Authentication → Users
2. 「Add user」ボタンでユーザーを作成
3. staffテーブルのuser_idを手動で更新

## 開発用デフォルトパスワード
全テストアカウント共通: `password123`