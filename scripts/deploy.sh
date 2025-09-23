#!/bin/bash

echo "🚀 Vercel デプロイをトリガー中..."
curl -X POST https://api.vercel.com/v1/integrations/deploy/prj_cOPk39qSDCz1KWpB5cNLzmOcNwn7/GGzR2tAh8y &
echo "✅ デプロイリクエストを送信しました"
echo "📝 Vercelダッシュボードで進捗を確認してください"
echo "   https://vercel.com/glasswerks/haas"