-- 견적 거래처 및 견적서 테이블 누락 컬럼 추가 (Optional)

-- 1. kiwe_quotation_clients 테이블 컬럼 추가
ALTER TABLE kiwe_quotation_clients 
ADD COLUMN IF NOT EXISTS biz_type TEXT,
ADD COLUMN IF NOT EXISTS biz_item TEXT,
ADD COLUMN IF NOT EXISTS worker_count INTEGER,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. kiwe_quotations 테이블 컬럼 추가
ALTER TABLE kiwe_quotations
ADD COLUMN IF NOT EXISTS preliminary_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS preliminary_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS contract_client_id BIGINT,
ADD COLUMN IF NOT EXISTS is_discount BOOLEAN DEFAULT false;

-- 기존 데이터에 대해 updated_at 초기화 (필요시)
UPDATE kiwe_quotation_clients SET updated_at = NOW() WHERE updated_at IS NULL;
