# Vercel デプロイ設定

## GitHub Secretsの設定

GitHubリポジトリの Settings → Secrets and variables → Actions に以下の値を追加してください：

### 必要なSecrets

1. **VERCEL_TOKEN**
   - Vercelアクセストークンを作成: https://vercel.com/account/tokens
   - "Create Token" をクリック
   - 名前を入力（例: `github-actions`）
   - Scopeは "Full Account" を選択
   - 作成されたトークンをコピー

2. **VERCEL_ORG_ID**
   ```
   team_WMsn5mJNVlgsnLmUmeBZYuhY
   ```

3. **VERCEL_PROJECT_ID**
   ```
   prj_cOPk39qSDCz1KWpB5cNLzmOcNwn7
   ```

## 設定手順

1. GitHubリポジトリ: https://github.com/kimny1143/hkt-assign-attendance-template/settings/secrets/actions
2. "New repository secret" をクリック
3. 上記の3つのSecretを追加

## デプロイの動作

- `main`ブランチへのpush時に自動デプロイ
- GitHub Actionsワークフローでデプロイを制御
- Vercel CLIを使用した確実なデプロイ