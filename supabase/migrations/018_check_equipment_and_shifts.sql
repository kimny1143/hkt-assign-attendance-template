-- ============================================
-- Equipment and Shifts Status Check
-- Date: 2025-09-22
-- Purpose: Diagnose QR code and shifts loading issues
-- ============================================

-- 1. Check equipment table for QR codes
SELECT
    'Equipment Check' as check_type,
    id,
    venue_id,
    name,
    qr_code,
    equipment_type,
    active,
    created_at
FROM public.equipment
WHERE qr_code LIKE '%HACHIOJI%'
ORDER BY qr_code;

-- 2. Check all equipment records
SELECT
    'All Equipment' as check_type,
    COUNT(*) as total_equipment,
    COUNT(DISTINCT venue_id) as unique_venues,
    COUNT(CASE WHEN active = true THEN 1 END) as active_equipment
FROM public.equipment;

-- 3. Check venues
SELECT
    'Venues' as check_type,
    id,
    name,
    lat,
    lon,
    capacity
FROM public.venues
ORDER BY name;

-- 4. Check events for today
SELECT
    'Today Events' as check_type,
    e.id,
    e.venue_id,
    e.event_date,
    e.open_time,
    e.start_time,
    e.end_time,
    v.name as venue_name
FROM public.events e
LEFT JOIN public.venues v ON e.venue_id = v.id
WHERE e.event_date = CURRENT_DATE
ORDER BY e.event_date;

-- 5. Check shifts
SELECT
    'Shifts Check' as check_type,
    s.id,
    s.event_id,
    s.skill_id,
    s.start_ts,
    s.end_ts,
    s.required,
    e.event_date
FROM public.shifts s
LEFT JOIN public.events e ON s.event_id = e.id
WHERE DATE(s.start_ts) = CURRENT_DATE
ORDER BY s.start_ts;

-- 6. Check skills table (formerly roles)
SELECT
    'Skills' as check_type,
    id,
    code,
    label,
    description
FROM public.skills
ORDER BY code;

-- 7. Check if specific QR exists
SELECT
    'QR Search' as check_type,
    COUNT(*) as qr_exists,
    CASE
        WHEN COUNT(*) > 0 THEN 'QR Found'
        ELSE 'QR NOT Found - Need to insert'
    END as status
FROM public.equipment
WHERE qr_code = 'HACHIOJI-LIGHT-001';

-- 8. Check table existence
SELECT
    'Table Check' as check_type,
    table_name,
    CASE
        WHEN table_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('equipment', 'venues', 'events', 'shifts', 'skills', 'staff')
ORDER BY table_name;