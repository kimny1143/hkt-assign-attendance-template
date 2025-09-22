#!/bin/bash

echo "📱 モバイルアクセス設定スクリプト"
echo "================================"

# 方法1: ローカルネットワークでアクセス
echo ""
echo "🏠 方法1: 同じWi-Fi内でアクセス"
echo "---------------------------------"

# IPアドレスを取得
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -n 1 | awk '{print $2}')

echo "1. 以下のコマンドで開発サーバーを起動:"
echo "   npm run dev -- --host 0.0.0.0"
echo ""
echo "2. スマホのブラウザで以下のURLにアクセス:"
echo "   http://${LOCAL_IP}:3000"
echo ""
echo "3. ログイン情報:"
echo "   管理者: admin@haas.test / password123"
echo "   スタッフ: staff1@haas.test / password123"
echo ""

# 方法2: ngrok
echo "🌐 方法2: ngrok（推奨）"
echo "---------------------"
echo ""
echo "# ngrokのインストール（Homebrew）:"
echo "brew install ngrok"
echo ""
echo "# または直接ダウンロード:"
echo "# https://ngrok.com/download"
echo ""
echo "# 使い方:"
echo "1. 開発サーバーを起動: npm run dev"
echo "2. 別ターミナルで: ngrok http 3000"
echo "3. 表示されるhttps://xxxxx.ngrok.ioのURLをスマホで開く"
echo ""

# 方法3: Vercelにデプロイ
echo "☁️  方法3: Vercelに一時デプロイ"
echo "-----------------------------"
echo ""
echo "# Vercel CLIインストール:"
echo "npm i -g vercel"
echo ""
echo "# デプロイ:"
echo "vercel --prod=false"
echo ""
echo "# 環境変数を設定してから、表示されるURLにアクセス"