import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock Supabase API endpoints
const supabaseHandlers = [
  // Auth endpoints
  http.post('https://test.supabase.co/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        user_metadata: {},
        app_metadata: { role: 'staff' },
      },
    })
  }),

  http.get('https://test.supabase.co/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: { role: 'staff' },
    })
  }),

  // Database endpoints
  http.get('https://test.supabase.co/rest/v1/staff', () => {
    return HttpResponse.json([
      {
        id: 'staff-1',
        name: 'Test Staff 1',
        email: 'staff1@example.com',
        role: 'staff',
        skills: ['PA', '照明'],
      },
      {
        id: 'staff-2',
        name: 'Test Staff 2',
        email: 'staff2@example.com',
        role: 'staff',
        skills: ['音源再生', 'バックヤード'],
      },
    ])
  }),

  http.get('https://test.supabase.co/rest/v1/skills', () => {
    return HttpResponse.json([
      { id: 'skill-1', name: 'PA', description: 'PA機材操作' },
      { id: 'skill-2', name: '音源再生', description: '音源再生マニピュレーター' },
      { id: 'skill-3', name: '照明', description: '照明操作' },
      { id: 'skill-4', name: 'バックヤード', description: 'バックヤード業務' },
    ])
  }),

  http.get('https://test.supabase.co/rest/v1/venues', () => {
    return HttpResponse.json([
      {
        id: 'venue-1',
        name: 'HKT48劇場',
        address: '福岡・BOSS E・ZO FUKUOKA内',
        latitude: 33.5904,
        longitude: 130.4017,
      },
    ])
  }),

  http.get('https://test.supabase.co/rest/v1/events', () => {
    return HttpResponse.json([
      {
        id: 'event-1',
        title: 'Test Event',
        venue_id: 'venue-1',
        event_date: '2025-01-21',
        start_time: '13:00:00',
        end_time: '21:00:00',
      },
    ])
  }),

  http.get('https://test.supabase.co/rest/v1/shifts', () => {
    return HttpResponse.json([
      {
        id: 'shift-1',
        event_id: 'event-1',
        skill_id: 'skill-1',
        start_time: '13:00:00',
        end_time: '21:00:00',
        required_count: 1,
      },
    ])
  }),

  http.post('https://test.supabase.co/rest/v1/staff', () => {
    return HttpResponse.json({
      id: 'new-staff-id',
      name: 'New Test Staff',
      email: 'newstaff@example.com',
      role: 'staff',
    }, { status: 201 })
  }),

  // RPC endpoints
  http.post('https://test.supabase.co/rest/v1/rpc/attendance_punch', () => {
    return HttpResponse.json({
      success: true,
      attendance_id: 'attendance-1',
      message: 'Punch successful',
    })
  }),
]

// Mock LINE API endpoints
const lineHandlers = [
  http.post('https://api.line.me/v2/bot/message/push', () => {
    return HttpResponse.json({ status: 'success' })
  }),

  http.post('https://api.line.me/v2/bot/message/reply', () => {
    return HttpResponse.json({ status: 'success' })
  }),
]

// Mock application API endpoints
const appHandlers = [
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        role: 'staff',
      },
    })
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      role: 'staff',
    })
  }),

  http.post('/api/attendance/punch', async ({ request }) => {
    const body = await request.json()

    return HttpResponse.json({
      success: true,
      attendance_id: 'attendance-1',
      action: body.action,
      timestamp: new Date().toISOString(),
    })
  }),

  http.post('/api/line-webhook', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/admin/staff', () => {
    return HttpResponse.json([
      {
        id: 'staff-1',
        name: 'Test Staff 1',
        email: 'staff1@example.com',
        role: 'staff',
        skills: ['PA', '照明'],
      },
    ])
  }),

  http.post('/api/admin/staff', () => {
    return HttpResponse.json({
      id: 'new-staff-id',
      name: 'New Test Staff',
      email: 'newstaff@example.com',
      role: 'staff',
    }, { status: 201 })
  }),
]

// Setup server with all handlers
export const server = setupServer(
  ...supabaseHandlers,
  ...lineHandlers,
  ...appHandlers
)