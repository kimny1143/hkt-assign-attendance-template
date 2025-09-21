/**
 * Test Data Fixtures
 *
 * This file contains seed data for testing the HAAS application.
 * All data follows the application's schema and business rules.
 */

// Test Skills (4 required roles)
export const TEST_SKILLS = [
  {
    id: 1,
    code: 'PA',
    label: 'PA',
    description: 'PA機材操作',
    category: 'technical',
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 2,
    code: 'AUDIO',
    label: '音源再生',
    description: '音源再生マニピュレーター',
    category: 'technical',
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 3,
    code: 'LIGHTING',
    label: '照明',
    description: '照明操作',
    category: 'technical',
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 4,
    code: 'BACKYARD',
    label: 'バックヤード',
    description: 'バックヤード業務',
    category: 'support',
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Venues
export const TEST_VENUES = [
  {
    id: 'venue-1',
    name: 'HKT48劇場',
    address: '福岡・BOSS E・ZO FUKUOKA内',
    latitude: 33.5904,
    longitude: 130.4017,
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Users and Staff
export const TEST_USERS = [
  {
    id: 'admin-user-1',
    email: 'admin@test.com',
    role: 'admin',
    staff: {
      id: 'admin-staff-1',
      user_id: 'admin-user-1',
      name: 'テスト管理者',
      email: 'admin@test.com',
      phone: '090-1111-1111',
      active: true,
      created_at: '2025-01-20T00:00:00Z',
    },
  },
  {
    id: 'manager-user-1',
    email: 'manager@test.com',
    role: 'manager',
    staff: {
      id: 'manager-staff-1',
      user_id: 'manager-user-1',
      name: 'テストマネージャー',
      email: 'manager@test.com',
      phone: '090-2222-2222',
      active: true,
      created_at: '2025-01-20T00:00:00Z',
    },
  },
  {
    id: 'staff-user-1',
    email: 'staff@test.com',
    role: 'staff',
    staff: {
      id: 'staff-1',
      user_id: 'staff-user-1',
      name: 'テストスタッフ1',
      email: 'staff@test.com',
      phone: '090-3333-3333',
      hourly_rate: 1500,
      active: true,
      created_at: '2025-01-20T00:00:00Z',
    },
  },
  {
    id: 'staff-user-2',
    email: 'staff2@test.com',
    role: 'staff',
    staff: {
      id: 'staff-2',
      user_id: 'staff-user-2',
      name: 'テストスタッフ2',
      email: 'staff2@test.com',
      phone: '090-4444-4444',
      hourly_rate: 1600,
      active: true,
      created_at: '2025-01-20T00:00:00Z',
    },
  },
  {
    id: 'multiskill-user-1',
    email: 'multiskill@test.com',
    role: 'staff',
    staff: {
      id: 'multiskill-staff-1',
      user_id: 'multiskill-user-1',
      name: 'マルチスキルスタッフ',
      email: 'multiskill@test.com',
      phone: '090-5555-5555',
      hourly_rate: 1800,
      active: true,
      created_at: '2025-01-20T00:00:00Z',
    },
  },
]

// Test Staff Skills (demonstrating all 4 skills and multi-skill staff)
export const TEST_STAFF_SKILLS = [
  // staff-1: PA specialist
  {
    id: 'staff-skill-1',
    staff_id: 'staff-1',
    skill_id: 1, // PA
    proficiency_level: 5,
    certified: true,
    created_at: '2025-01-20T00:00:00Z',
  },

  // staff-2: Audio specialist
  {
    id: 'staff-skill-2',
    staff_id: 'staff-2',
    skill_id: 2, // 音源再生
    proficiency_level: 4,
    certified: true,
    created_at: '2025-01-20T00:00:00Z',
  },

  // multiskill-staff-1: All skills (demonstrates multi-skill requirement)
  {
    id: 'staff-skill-3',
    staff_id: 'multiskill-staff-1',
    skill_id: 1, // PA
    proficiency_level: 5,
    certified: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'staff-skill-4',
    staff_id: 'multiskill-staff-1',
    skill_id: 2, // 音源再生
    proficiency_level: 4,
    certified: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'staff-skill-5',
    staff_id: 'multiskill-staff-1',
    skill_id: 3, // 照明
    proficiency_level: 4,
    certified: false,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'staff-skill-6',
    staff_id: 'multiskill-staff-1',
    skill_id: 4, // バックヤード
    proficiency_level: 3,
    certified: false,
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Events
export const TEST_EVENTS = [
  {
    id: 'event-1',
    title: 'テストコンサート',
    venue_id: 'venue-1',
    event_date: '2025-01-21',
    start_time: '13:00:00',
    end_time: '21:00:00',
    description: 'テスト用のコンサートイベント',
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'event-2',
    title: 'テストイベント2',
    venue_id: 'venue-1',
    event_date: '2025-01-22',
    start_time: '13:00:00',
    end_time: '21:00:00',
    description: '複数日テスト用イベント',
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Shifts (demonstrating all 4 skill requirements)
export const TEST_SHIFTS = [
  {
    id: 'shift-1',
    event_id: 'event-1',
    skill_id: 1, // PA
    start_time: '13:00:00',
    end_time: '21:00:00',
    required_count: 1,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'shift-2',
    event_id: 'event-1',
    skill_id: 2, // 音源再生
    start_time: '13:00:00',
    end_time: '21:00:00',
    required_count: 1,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'shift-3',
    event_id: 'event-1',
    skill_id: 3, // 照明
    start_time: '13:00:00',
    end_time: '21:00:00',
    required_count: 1,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'shift-4',
    event_id: 'event-1',
    skill_id: 4, // バックヤード
    start_time: '13:00:00',
    end_time: '21:00:00',
    required_count: 1,
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Equipment (for QR code testing)
export const TEST_EQUIPMENT = [
  {
    id: 'equipment-1',
    name: 'PA Console',
    qr_code: 'TEST-PA-QR-12345',
    venue_id: 'venue-1',
    skill_id: 1, // PA
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'equipment-2',
    name: '音源再生機器',
    qr_code: 'TEST-AUDIO-QR-67890',
    venue_id: 'venue-1',
    skill_id: 2, // 音源再生
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'equipment-3',
    name: '照明コンソール',
    qr_code: 'TEST-LIGHT-QR-11111',
    venue_id: 'venue-1',
    skill_id: 3, // 照明
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'equipment-4',
    name: 'バックヤード機器',
    qr_code: 'TEST-BACK-QR-22222',
    venue_id: 'venue-1',
    skill_id: 4, // バックヤード
    active: true,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'equipment-invalid',
    name: '無効な機器',
    qr_code: 'INVALID-QR-99999',
    venue_id: 'venue-1',
    skill_id: 1,
    active: false, // Inactive equipment
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Assignments
export const TEST_ASSIGNMENTS = [
  {
    id: 'assignment-1',
    shift_id: 'shift-1',
    staff_id: 'staff-1',
    status: 'confirmed',
    is_reserve: false,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'assignment-2',
    shift_id: 'shift-2',
    staff_id: 'staff-2',
    status: 'confirmed',
    is_reserve: false,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'assignment-3',
    shift_id: 'shift-3',
    staff_id: 'multiskill-staff-1',
    status: 'confirmed',
    is_reserve: false,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'assignment-4',
    shift_id: 'shift-4',
    staff_id: 'multiskill-staff-1',
    status: 'confirmed',
    is_reserve: false,
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Test Attendances
export const TEST_ATTENDANCES = [
  {
    id: 'attendance-1',
    assignment_id: 'assignment-1',
    check_in_time: '2025-01-21T13:00:00Z',
    check_out_time: null,
    location_lat: 33.5904,
    location_lng: 130.4017,
    equipment_qr: 'TEST-PA-QR-12345',
    created_at: '2025-01-21T13:00:00Z',
  },
]

// Test Staff Schedules
export const TEST_STAFF_SCHEDULES = [
  {
    id: 'schedule-1',
    staff_id: 'staff-1',
    week_start: '2025-01-20', // Monday
    monday: true,
    tuesday: true,
    wednesday: false,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'schedule-2',
    staff_id: 'multiskill-staff-1',
    week_start: '2025-01-20',
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: false, // Ensures weekly rest day
    created_at: '2025-01-20T00:00:00Z',
  },
]

// QR Token Test Data
export const TEST_QR_TOKENS = [
  {
    id: 'qr-token-1',
    shift_id: 'shift-1',
    token: 'qr-checkin-shift1-20250121',
    purpose: 'checkin',
    expires_at: '2025-01-21T23:59:59Z',
    created_at: '2025-01-21T00:00:00Z',
  },
  {
    id: 'qr-token-2',
    shift_id: 'shift-1',
    token: 'qr-checkout-shift1-20250121',
    purpose: 'checkout',
    expires_at: '2025-01-21T23:59:59Z',
    created_at: '2025-01-21T00:00:00Z',
  },
  {
    id: 'qr-token-expired',
    shift_id: 'shift-1',
    token: 'qr-expired-token-12345',
    purpose: 'checkin',
    expires_at: '2025-01-20T23:59:59Z', // Expired
    created_at: '2025-01-20T00:00:00Z',
  },
]

// User Roles
export const TEST_USER_ROLES = [
  {
    id: 'role-1',
    staff_id: 'admin-staff-1',
    role: 'admin',
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'role-2',
    staff_id: 'manager-staff-1',
    role: 'manager',
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'role-3',
    staff_id: 'staff-1',
    role: 'staff',
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'role-4',
    staff_id: 'staff-2',
    role: 'staff',
    created_at: '2025-01-20T00:00:00Z',
  },
  {
    id: 'role-5',
    staff_id: 'multiskill-staff-1',
    role: 'staff',
    created_at: '2025-01-20T00:00:00Z',
  },
]

// Complete test dataset
export const TEST_DATA = {
  skills: TEST_SKILLS,
  venues: TEST_VENUES,
  users: TEST_USERS,
  staff_skills: TEST_STAFF_SKILLS,
  events: TEST_EVENTS,
  shifts: TEST_SHIFTS,
  equipment: TEST_EQUIPMENT,
  assignments: TEST_ASSIGNMENTS,
  attendances: TEST_ATTENDANCES,
  staff_schedules: TEST_STAFF_SCHEDULES,
  qr_tokens: TEST_QR_TOKENS,
  user_roles: TEST_USER_ROLES,
}

// Helper functions for test data
export function getStaffByRole(role: 'admin' | 'manager' | 'staff') {
  return TEST_USERS.filter(user => user.role === role)
}

export function getStaffWithSkill(skillId: number) {
  const staffIds = TEST_STAFF_SKILLS
    .filter(ss => ss.skill_id === skillId)
    .map(ss => ss.staff_id)

  return TEST_USERS.filter(user => staffIds.includes(user.staff.id))
}

export function getMultiSkillStaff() {
  const skillCounts = TEST_STAFF_SKILLS.reduce((acc, ss) => {
    acc[ss.staff_id] = (acc[ss.staff_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const multiSkillStaffIds = Object.entries(skillCounts)
    .filter(([, count]) => count >= 2)
    .map(([staffId]) => staffId)

  return TEST_USERS.filter(user => multiSkillStaffIds.includes(user.staff.id))
}

export function isEventFullyStaffed(eventId: string) {
  const eventShifts = TEST_SHIFTS.filter(shift => shift.event_id === eventId)
  const eventAssignments = TEST_ASSIGNMENTS.filter(assignment =>
    eventShifts.some(shift => shift.id === assignment.shift_id)
  )

  // Check if all 4 skills are covered
  const assignedSkills = new Set(
    eventShifts
      .filter(shift => eventAssignments.some(a => a.shift_id === shift.id))
      .map(shift => shift.skill_id)
  )

  return assignedSkills.size === 4 // All 4 skills covered
}