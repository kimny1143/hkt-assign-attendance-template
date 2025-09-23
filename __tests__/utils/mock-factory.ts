/**
 * Centralized Mock Factory for HAAS Tests
 * 重複モックロジックを一元化
 */

import { createClient } from '@supabase/supabase-js'

export class MockFactory {
  /**
   * Supabase クライアントのモック
   */
  static createSupabaseClient() {
    return {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        })),
      },
    }
  }

  /**
   * 認証済みユーザーのモック
   */
  static createAuthenticatedUser(overrides = {}) {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'staff',
      ...overrides,
    }
  }

  /**
   * GPS位置情報のモック
   */
  static createLocationMock(options = {}) {
    const defaults = {
      latitude: 35.6762,
      longitude: 139.6503,
      accuracy: 10,
    }
    return { ...defaults, ...options }
  }

  /**
   * QRトークンのモック
   */
  static createQRTokenMock(options = {}) {
    const defaults = {
      token: 'valid-token-2024-09-23',
      shift_id: 'shift-001',
      purpose: 'checkin',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }
    return { ...defaults, ...options }
  }

  /**
   * スタッフスキルのモック（4スキルシステム）
   */
  static createStaffSkillsMock() {
    return {
      PA: true,
      音源再生: false,
      照明: true,
      バックヤード: false,
    }
  }

  /**
   * NextRequestのモック
   */
  static createNextRequest(url = 'http://localhost:3000', options = {}) {
    return {
      url,
      method: options.method || 'GET',
      headers: new Headers(options.headers || {}),
      json: jest.fn().mockResolvedValue(options.body || {}),
      text: jest.fn().mockResolvedValue(JSON.stringify(options.body || {})),
      formData: jest.fn().mockResolvedValue(new FormData()),
    }
  }
}