-- kiwe_requests 테이블에 total_count(공시료 포함 총 시료수) 컬럼 추가
ALTER TABLE public.kiwe_requests ADD COLUMN IF NOT EXISTS total_count INTEGER;
COMMENT ON COLUMN public.kiwe_requests.total_count IS '공시료 포함 총 의뢰 시료수';
