-- ============================================
-- Optional: Add Geography Column for Spatial Index
-- ============================================
-- This migration adds a proper geography column to venues table
-- for better spatial indexing and query performance
-- ============================================

-- Add geography column to venues table (if you want full spatial indexing)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Update existing records to populate the geography column
UPDATE venues
SET location = ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
WHERE location IS NULL AND lon IS NOT NULL AND lat IS NOT NULL;

-- Create spatial index on the geography column
CREATE INDEX IF NOT EXISTS idx_venues_location_gist ON venues USING GIST (location);

-- Update the check_attendance_location function to use the geography column
CREATE OR REPLACE FUNCTION check_attendance_location(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_venue_id UUID,
    p_max_distance_meters INTEGER DEFAULT 300
) RETURNS TABLE (
    is_valid BOOLEAN,
    distance_meters DOUBLE PRECISION,
    venue_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN ST_Distance(
                v.location,
                ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
            ) <= p_max_distance_meters THEN true
            ELSE false
        END as is_valid,
        ST_Distance(
            v.location,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
        ) as distance_meters,
        v.name as venue_name
    FROM venues v
    WHERE v.id = p_venue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;