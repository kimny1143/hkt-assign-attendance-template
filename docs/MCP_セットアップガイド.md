# MCP (Model Context Protocol) セットアップガイド

## 📋 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [インストール手順](#インストール手順)
4. [Claude Desktop設定](#claude-desktop設定)
5. [MCPサーバーの詳細](#mcpサーバーの詳細)
6. [使用方法](#使用方法)
7. [トラブルシューティング](#トラブルシューティング)

## 概要

このガイドでは、HAAS（Hardware as a Service）スタッフ管理・出退勤システムにMCPを統合する手順を説明します。MCPを使用することで、Claude Desktopから直接以下の操作が可能になります：

- 🧪 自動テスト生成
- 🧭 HAASプロジェクト特有のコード検索
- 🏗️ ビルド・開発タスクの実行
- 🗄️ Supabaseデータベース操作

## 前提条件

### 必須要件

- ✅ Node.js 18以上
- ✅ npm または pnpm
- ✅ Claude Desktop（MCP対応版）
- ✅ Supabaseアカウント（データベース操作用）

### 推奨環境

- macOS 12.0以上
- メモリ 8GB以上
- VSCode（開発用）

## インストール手順

### 1. プロジェクトの依存関係をインストール

```bash
# プロジェクトディレクトリに移動
cd /Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template

# 依存関係をインストール
npm install

# MCP関連パッケージをインストール（必要な場合）
npm install @modelcontextprotocol/sdk
```

### 2. MCPサーバーファイルの確認

以下のMCPサーバーファイルが `scripts/mcp/` ディレクトリに作成されています：

```
scripts/mcp/
├── jest-test-server.js      # テスト生成サーバー
├── haas-navigation-server.js # HAAS特化検索サーバー
├── build-dev-server.js       # ビルド・開発サーバー
└── supabase-ops-server.js    # Supabase操作サーバー
```

### 3. 環境変数の設定

`.env.local`ファイルに以下の環境変数を設定：

```bash
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LINE設定（オプション）
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token

# アプリケーション設定
APP_BASE_URL=http://localhost:3000
```

## Claude Desktop設定

### 設定ファイルの場所

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 設定内容

設定ファイルは既に更新されていますが、内容は以下の通りです：

```json
{
  "mcpServers": {
    "haas_jest_tests": {
      "command": "node",
      "args": ["/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/scripts/mcp/jest-test-server.js"],
      "env": {
        "TEST_DIR": "/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/__tests__",
        "SRC_DIR": "/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/app",
        "LIB_DIR": "/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/lib"
      }
    },
    "haas_navigation": {
      "command": "node",
      "args": ["/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/scripts/mcp/haas-navigation-server.js"]
    },
    "haas_build_dev": {
      "command": "node",
      "args": ["/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/scripts/mcp/build-dev-server.js"]
    },
    "haas_supabase_ops": {
      "command": "node",
      "args": ["/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template/scripts/mcp/supabase-ops-server.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "${NEXT_PUBLIC_SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
      }
    }
  }
}
```

### Claude Desktopの再起動

設定を反映させるために、Claude Desktopを完全に終了して再起動してください：

1. Claude Desktopを終了（Cmd+Q / Alt+F4）
2. 再度Claude Desktopを起動
3. MCPサーバーが自動的に読み込まれます

## MCPサーバーの詳細

### 1. Jest テスト生成サーバー (`haas_jest_tests`)

**機能：**
- コンポーネントのユニットテスト生成
- APIエンドポイントの統合テスト作成
- カバレッジ分析と改善提案
- HAAS特有のテストパターン対応

**使用例：**
```
「attendance/punch.tsのユニットテストを生成して」
「QRトークン検証のテストを作成」
「GPSバリデーションのテストカバレッジを改善」
```

### 2. HAAS ナビゲーションサーバー (`haas_navigation`)

**機能：**
- 4スキルシステム（PA、音源再生、照明、バックヤード）の検索
- GPS検証ロジックの探索
- QRトークン実装の検索
- LINE統合コードの特定
- Supabaseスキーマの発見

**使用例：**
```
「GPS検証のロジックを探して」
「PAスキルに関連するコードを表示」
「QRトークン生成の実装を見せて」
「出勤打刻のAPIエンドポイントを探して」
```

### 3. ビルド・開発サーバー (`haas_build_dev`)

**機能：**
- 開発サーバーの起動/停止
- テストの実行（unit、integration、E2E）
- 本番ビルドの作成
- リンティングと型チェック
- Supabase関数のデプロイ
- データベースマイグレーション

**使用例：**
```
「開発サーバーを起動」
「すべてのテストを実行」
「本番用ビルドを作成」
「型エラーをチェック」
```

### 4. Supabase 操作サーバー (`haas_supabase_ops`)

**機能：**
- データベースクエリの実行
- テーブルスキーマの確認
- GPS出勤検証（300m以内）のテスト
- QRトークンステータスの監視
- スタッフ割り当ての分析
- テストデータの生成

**使用例：**
```
「今日のQRトークンステータスを確認」
「会場から300m以内の出勤記録を取得」
「PAスキルを持つスタッフの今週の割り当てを表示」
「テスト用のスタッフデータを生成」
```

## 使用方法

### 基本的な使い方

1. **Claude Desktopを起動**
2. **自然言語でコマンドを入力**

### よく使うコマンド例

#### テスト関連
```
「新しく作成したコンポーネントのテストを生成」
「APIエンドポイントの統合テストを作成」
「カバレッジが低いファイルを特定してテストを追加」
```

#### 開発関連
```
「開発サーバーを起動してブラウザで開く」
「テストを実行してカバレッジレポートを表示」
「型エラーとリントエラーを修正」
```

#### データベース関連
```
「今日の出勤データを確認」
「特定の会場のGPS座標を更新」
「スタッフのスキル割り当てを変更」
```

#### HAAS特有の操作
```
「GPS検証の半径を300mから500mに変更」
「QRトークンの有効期限を24時間に延長」
「照明スキルを持つスタッフの稼働状況を確認」
「LINE通知の送信ログを表示」
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. MCPサーバーが認識されない

**原因：** Claude Desktopが正しく再起動されていない

**解決方法：**
```bash
# Claude Desktopを完全に終了
killall "Claude Desktop"

# 再起動
open -a "Claude Desktop"
```

#### 2. 権限エラーが発生する

**原因：** スクリプトファイルに実行権限がない

**解決方法：**
```bash
# MCPサーバーファイルに実行権限を付与
chmod +x scripts/mcp/*.js
```

#### 3. Supabase接続エラー

**原因：** 環境変数が正しく設定されていない

**解決方法：**
1. `.env.local`ファイルを確認
2. Supabaseダッシュボードから正しいキーを取得
3. Claude Desktopを再起動

#### 4. テスト生成が失敗する

**原因：** ソースファイルのパスが正しくない

**解決方法：**
- 設定ファイルのパスが絶対パスになっているか確認
- ファイルが実際に存在するか確認

### ログの確認

問題が発生した場合、以下のログを確認：

```bash
# Claude Desktopのログ
~/Library/Logs/Claude/

# Node.jsのエラーログ
npm run mcp:debug
```

### サポート

問題が解決しない場合：

1. プロジェクトのissuesを確認
2. ドキュメントを再確認
3. 環境変数とパスの設定を見直す

## セキュリティに関する注意事項

### 重要な注意点

- ⚠️ **Supabaseキーを公開リポジトリにコミットしない**
- ⚠️ **`.env.local`ファイルを`.gitignore`に追加**
- ⚠️ **本番環境のキーは別管理**

### ベストプラクティス

1. **開発用と本番用でキーを分ける**
2. **定期的にキーをローテーション**
3. **MCPサーバーのアクセスを制限**
4. **監査ログを有効化**

## まとめ

MCPの統合により、Claude Desktopから直接HAASプロジェクトの開発作業を効率的に行えるようになります。特に以下の点で生産性が向上します：

- ✨ **自動テスト生成による開発速度の向上**
- 🎯 **HAAS特有の機能への素早いアクセス**
- 🚀 **ビルド・デプロイプロセスの簡素化**
- 📊 **データベース操作の効率化**

質問や問題がある場合は、このドキュメントを参照するか、プロジェクトのissuesで報告してください。