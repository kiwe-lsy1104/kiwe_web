-- ============================================================
-- 소음대장(kiwe_noise_records) 컬럼 추가
-- ============================================================

-- 1. 소음보정일 컬럼 추가
ALTER TABLE kiwe_noise_records
ADD COLUMN IF NOT EXISTS cal_date DATE;

-- 2. 보정기번호 컬럼 추가 (1~4번 소음보정기 번호)
--    추후 1~4번별 보정기 시리얼번호에 매핑할 예정
ALTER TABLE kiwe_noise_records
ADD COLUMN IF NOT EXISTS calibrator_no TEXT;

-- 3. 기존 데이터에 소음보정일 자동 채우기 (선택사항)
--    측정일 기준 직전 평일 계산:
--      - 월요일(DOW=1) → 3일 전 (금요일)
--      - 일요일(DOW=0) → 2일 전 (금요일)
--      - 화~토(DOW=2~6) → 1일 전
UPDATE kiwe_noise_records
SET cal_date = CASE
    WHEN EXTRACT(DOW FROM m_date::date) = 1 THEN m_date::date - INTERVAL '3 days'
    WHEN EXTRACT(DOW FROM m_date::date) = 0 THEN m_date::date - INTERVAL '2 days'
    ELSE m_date::date - INTERVAL '1 day'
END
WHERE m_date IS NOT NULL
  AND cal_date IS NULL;
