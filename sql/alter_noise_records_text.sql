-- ============================================================
-- kiwe_noise_records 테이블 컬럼 타입 변경
-- temp, humidity: NUMERIC → TEXT (예: "25", "1~10", "25.5" 등 자유로운 텍스트 입력 허용)
-- ============================================================

-- 기존 테이블의 temp, humidity 컬럼을 TEXT로 변경
ALTER TABLE kiwe_noise_records
    ALTER COLUMN temp TYPE TEXT USING temp::TEXT,
    ALTER COLUMN humidity TYPE TEXT USING humidity::TEXT;

-- 확인
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'kiwe_noise_records' AND column_name IN ('temp', 'humidity');
