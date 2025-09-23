import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Only create supabase client if credentials are available
const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

function verifySignature(body: string, signature: string) {
  const hmac = crypto.createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64')
  return hmac === signature
}

export async function POST(req: NextRequest) {
  // Check if environment is properly configured
  if (!supabase || !CHANNEL_SECRET) {
    console.error('LINE webhook not configured properly')
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('x-line-signature') || ''
  if (!verifySignature(body, sig)) return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  const payload = JSON.parse(body)

  for (const ev of payload.events ?? []) {
    if (ev.type === 'message' && ev.message?.type === 'text') {
      const text: string = (ev.message.text as string).trim()
      const [cmd, id] = text.split(/\s+/)
      if (cmd === 'CONFIRM') {
        await supabase.from('assignments').update({ status: 'confirmed', accepted_at: new Date().toISOString() }).eq('id', id)
      } else if (cmd === 'DECLINE') {
        await supabase.from('assignments').update({ status: 'declined', declined_at: new Date().toISOString() }).eq('id', id)
        // TODO: 次点候補へ繰上げ
      }
    }
  }
  return NextResponse.json({ ok: true })
}