-- ============================================
-- [주의] 기존 데이터 및 테이블을 초기화합니다.
-- 실행 전 반드시 기존 데이터를 백업하세요.
-- ============================================

DROP TABLE IF EXISTS kiwe_quotation_items CASCADE;
DROP TABLE IF EXISTS kiwe_quotations CASCADE;
DROP TABLE IF EXISTS kiwe_quotation_clients CASCADE;

-- ============================================
-- 1. kiwe_quotation_clients: 견적 거래처 테이블
-- ============================================
CREATE TABLE kiwe_quotation_clients (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  com_id TEXT, -- KiWE 기본 사업장 연동용 ID
  biz_reg_no TEXT,
  ceo_name TEXT,
  address TEXT,
  tel TEXT,
  fax TEXT,
  manager_name TEXT, -- 담당자명 추가
  contact_person TEXT,
  contact_email TEXT,
  biz_type TEXT,
  biz_item TEXT,
  worker_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. kiwe_quotations: 견적서 헤더 테이블
-- ============================================
CREATE TABLE kiwe_quotations (
  id BIGSERIAL PRIMARY KEY,
  quote_no TEXT,
  quote_seq INTEGER DEFAULT 0,
  year INTEGER NOT NULL,
  half_year TEXT,
  quote_date DATE,
  valid_days INTEGER DEFAULT 30,
  client_id BIGINT REFERENCES kiwe_quotation_clients(id),
  client_name TEXT,
  client_ceo TEXT,     -- 거래처 대표자명 (스냅샷)
  client_address TEXT, -- 거래처 주소 (스냅샷)
  client_tel TEXT,     -- 거래처 전화 (스냅샷)
  client_fax TEXT,     -- 거래처 팩스 (스냅샷)
  client_manager TEXT, -- 거래처 담당자명 (스냅샷)
  quote_type TEXT NOT NULL DEFAULT '일반',
  is_cost_support BOOLEAN DEFAULT false,
  support_type TEXT DEFAULT '일반', -- 기존지원, 신규지원 등
  workplace_size TEXT,
  management_fee NUMERIC DEFAULT 0,
  sampling_days INTEGER DEFAULT 1,
  discount_rate NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0, -- 희망금액(할인금액) - O열
  actual_amount NUMERIC DEFAULT 0,   -- 실금액 (기본관리비+분석수수료) - L열
  support_amount NUMERIC DEFAULT 0,  -- 공단지원금 - M열
  total_amount NUMERIC DEFAULT 0,    -- 최종견적금액 - K열
  round_unit INTEGER DEFAULT 0,      -- 절삭 단위 (0:없음, 1:천원, 2:만원)
  preliminary_fee NUMERIC DEFAULT 0, -- 예비조사 단가 (계약단가)
  preliminary_days INTEGER DEFAULT 1, -- 예비조사 일수
  contract_client_id BIGINT,         -- 계약단가 적용 시 거래처 ID
  is_discount BOOLEAN DEFAULT false, -- 할인단가 여부
  payment_terms TEXT DEFAULT '현금',
  notes TEXT,
  title TEXT DEFAULT '작업환경측정 견적서',
  status TEXT DEFAULT '작성중',
  manager_name TEXT, -- 공급처 담당자명 (작성자)
  created_by TEXT,   -- 작성자 ID 등
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. kiwe_quotation_items: 견적서 세부 내역 테이블
-- ============================================
CREATE TABLE kiwe_quotation_items (
  id BIGSERIAL PRIMARY KEY,
  quotation_id BIGINT REFERENCES kiwe_quotations(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  work_process TEXT,
  hazard_name TEXT,
  analysis_method TEXT,
  unit_type TEXT DEFAULT '식',
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 설정 (전체 허용 - 단순화를 위해)
ALTER TABLE kiwe_quotation_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiwe_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiwe_quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_clients" ON kiwe_quotation_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_quotations" ON kiwe_quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_items" ON kiwe_quotation_items FOR ALL USING (true) WITH CHECK (true);
