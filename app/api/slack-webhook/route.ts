import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Only create supabase client if credentials are available
const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

// Slack署名検証
function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const baseString = `v0:${timestamp}:${body}`
  const hmac = crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex')
  const computedSignature = `v0=${hmac}`
  return computedSignature === signature
}

export async function POST(req: NextRequest) {
  // Check if environment is properly configured
  if (!supabase || !SLACK_SIGNING_SECRET) {
    console.error('Slack webhook not configured properly')
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-slack-signature') || ''
  const timestamp = req.headers.get('x-slack-request-timestamp') || ''

  // タイムスタンプが5分以上古い場合は拒否
  const currentTime = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTime - parseInt(timestamp)) > 60 * 5) {
    return NextResponse.json({ error: 'Request timeout' }, { status: 400 })
  }

  // 署名検証
  if (!verifySlackSignature(signature, timestamp, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(body)

  // URLVerificationチャレンジ（初回設定時）
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // インタラクティブメッセージ（ボタンクリック）の処理
  if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
    const action = payload.actions?.[0]
    if (action) {
      const [cmd, id] = action.value.split(':')

      if (cmd === 'confirm') {
        await supabase
          .from('assignments')
          .update({
            status: 'confirmed',
            accepted_at: new Date().toISOString()
          })
          .eq('id', id)

        // Slackメッセージを更新
        await updateSlackMessage(payload.response_url, '✅ アサインを承認しました')

      } else if (cmd === 'decline') {
        await supabase
          .from('assignments')
          .update({
            status: 'declined',
            declined_at: new Date().toISOString()
          })
          .eq('id', id)

        // Slackメッセージを更新
        await updateSlackMessage(payload.response_url, '❌ アサインを辞退しました')

        // TODO: 次点候補へ繰上げ
      }
    }
  }

  // スラッシュコマンドの処理
  if (payload.command) {
    if (payload.command === '/attendance') {
      // 勤怠状況を返す
      return NextResponse.json({
        response_type: 'ephemeral',
        text: '本日の勤怠状況を確認中...'
      })
    }
  }

  return NextResponse.json({ ok: true })
}

// Slackメッセージを更新
async function updateSlackMessage(responseUrl: string, text: string) {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      replace_original: true
    })
  })
}

// Slack通知送信用のヘルパー関数（内部使用のみ）
async function sendSlackNotification(
  channel: string,
  text: string,
  blocks?: any[]
) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel,
      text,
      blocks
    })
  })

  return response.json()
}