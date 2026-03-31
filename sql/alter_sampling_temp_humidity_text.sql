-- ============================================================
-- kiwe_sampling_yyyy_n 테이블들의 temp, humidity 컬럼 타입 변경
-- NUMERIC → TEXT (예: "25", "19~25", "20.5~28" 등 범위 텍스트 허용)
-- ============================================================
-- 아래 SQL을 현존하는 모든 반기 테이블에 대해 실행하세요.
-- (예: kiwe_sampling_2025_1, kiwe_sampling_2025_2, kiwe_sampling_2026_1 ...)

-- 2025년 상반기
ALTER TABLE kiwe_sampling_2025_1
    ALTER COLUMN temp TYPE TEXT USING temp::TEXT,
    ALTER COLUMN humidity TYPE TEXT USING humidity::TEXT;

-- 2025년 하반기
ALTER TABLE kiwe_sampling_2025_2
    ALTER COLUMN temp TYPE TEXT USING temp::TEXT,
    ALTER COLUMN humidity TYPE TEXT USING humidity::TEXT;

-- 2026년 상반기
ALTER TABLE kiwe_sampling_2026_1
    ALTER COLUMN temp TYPE TEXT USING temp::TEXT,
    ALTER COLUMN humidity TYPE TEXT USING humidity::TEXT;

-- 2026년 하반기 (필요 시)
-- ALTER TABLE kiwe_sampling_2026_2
--     ALTER COLUMN temp TYPE TEXT USING temp::TEXT,
--     ALTER COLUMN humidity TYPE TEXT USING humidity::TEXT;

-- ★ 앞으로 새로 생성하는 테이블은 처음부터 TEXT로 생성해야 합니다.
-- 확인:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name LIKE 'kiwe_sampling_%' AND column_name IN ('temp', 'humidity')
-- ORDER BY table_name;
