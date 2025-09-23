# Vercel Deploy Hook設定

## 自動デプロイが動かない場合の回避策

Vercelの自動デプロイが不安定な場合、Deploy Hookを使用して手動でトリガーできます。

## Deploy Hookの作成

1. Vercelダッシュボードを開く
2. Settings → Git → Deploy Hooks
3. "Create Hook"をクリック
4. 名前を入力（例: `manual-deploy`）
5. Branch: `main`を選択
6. 作成されたURLをコピー

## 使用方法

### コマンドラインから実行
```bash
curl -X POST https://api.vercel.com/v1/integrations/deploy/YOUR_DEPLOY_HOOK_URL
```

### GitHub Actionsから実行（必要な場合）
```yaml
- name: Trigger Vercel Deploy
  run: curl -X POST ${{ secrets.VERCEL_DEPLOY_HOOK }}
```

## 既知の問題

Vercel公式ドキュメントによると、以下の問題が報告されています：

1. **Webhook未作成**: GitHub連携時にWebhookが作成されないケース
2. **コミットスキップ**: 一部のコミットが認識されない
3. **遅延**: デプロイが数分〜数時間遅れることがある

## トラブルシューティング

1. Git設定の確認
```bash
git config user.email  # GitHubアカウントと一致することを確認
git config user.name
```

2. Vercel CLIで手動デプロイ
```bash
npx vercel --prod
```

3. GitHub Webhookの確認
- リポジトリSettings → Webhooks
- Vercel webhookが存在し、最近のdeliveryが成功しているか確認

## 参考リンク

- [Why aren't commits triggering deployments on Vercel?](https://vercel.com/guides/why-aren-t-commits-triggering-deployments-on-vercel)
- [GitHub Webhook Not Created](https://community.vercel.com/t/github-webhook-not-created-deployments-not-triggering/15935)
- [Vercel Skip Commits Issue](https://github.com/vercel/community/discussions/1018)