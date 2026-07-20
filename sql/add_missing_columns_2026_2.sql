-- =============================================
-- kiwe_sampling_2026_2 누락 컬럼 추가 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. analyst (분석자) 컬럼 추가
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS analyst TEXT;

-- 2. measured_min (측정시간/분) 컬럼 추가
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS measured_min INTEGER;

-- 3. 유량보정 컬럼 추가 (측정전 평균 1회 / 측정후 평균 1회)
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS pre_flow_avg NUMERIC(10,3);
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS post_flow_avg NUMERIC(10,3);

-- 4. 기타 누락 컬럼
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS hazard_category TEXT;
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS instrument_name TEXT;
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS sampling_media TEXT;
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS is_self TEXT;
ALTER TABLE kiwe_sampling_2026_2
    ADD COLUMN IF NOT EXISTS remarks TEXT;

-- =============================================
-- 확인 쿼리 (실행 후 아래로 컬럼 목록 확인)
-- =============================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'kiwe_sampling_2026_2'
ORDER BY ordinal_position;
