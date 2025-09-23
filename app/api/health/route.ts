import { NextResponse } from 'next/server'
import { toSupabaseTimestamp } from '@/lib/utils/date'

/**
 * Health check endpoint for monitoring and E2E tests
 * GET /api/health
 */
export async function GET() {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: toSupabaseTimestamp(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    }

    // Check environment variables are loaded
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    )

    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          ...health,
          status: 'warning',
          message: `Missing environment variables: ${missingEnvVars.join(', ')}`,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(health, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        timestamp: toSupabaseTimestamp(),
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}