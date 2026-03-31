-- ============================================================
-- kiwe_sampling_yyyy_n 테이블들의 pump_no 컬럼 타입 변경
-- NUMERIC/INTEGER → TEXT (예: "9", "9-1", "9-2" 등 하이픈 포함 텍스트 허용)
-- ============================================================
-- 아래 SQL을 현존하는 모든 반기 테이블에 대해 실행하세요.

-- 2025년 상반기
ALTER TABLE kiwe_sampling_2025_1
    ALTER COLUMN pump_no TYPE TEXT USING pump_no::TEXT;

-- 2025년 하반기
ALTER TABLE kiwe_sampling_2025_2
    ALTER COLUMN pump_no TYPE TEXT USING pump_no::TEXT;

-- 2026년 상반기
ALTER TABLE kiwe_sampling_2026_1
    ALTER COLUMN pump_no TYPE TEXT USING pump_no::TEXT;

-- 2026년 하반기 (필요 시)
-- ALTER TABLE kiwe_sampling_2026_2
--     ALTER COLUMN pump_no TYPE TEXT USING pump_no::TEXT;

-- 확인:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name LIKE 'kiwe_sampling_%' AND column_name = 'pump_no'
-- ORDER BY table_name;
