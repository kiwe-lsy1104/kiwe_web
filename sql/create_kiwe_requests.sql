-- 외부 분석 의뢰 마스터 테이블
CREATE TABLE IF NOT EXISTS public.kiwe_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_date DATE NOT NULL,
    partner_id INTEGER REFERENCES public.kiwe_partners(partner_id),
    document_no VARCHAR(100), -- 발신번호 (초기에는 비워둠)
    expected_receive_date DATE NOT NULL, -- 결과수신예정일 (의뢰일 + 15일)
    receive_date DATE, -- 실제 결과 수령일
    status VARCHAR(50) NOT NULL DEFAULT '의뢰중', -- '의뢰중', '결과수령완료'
    total_count INTEGER DEFAULT 0, -- 공시료 포함 총 의뢰 시료수
    created_by VARCHAR(100) NOT NULL, -- 작성자명
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 외부 분석 의뢰 시료 목록 매핑 테이블
CREATE TABLE IF NOT EXISTS public.kiwe_request_items (
    request_id UUID REFERENCES public.kiwe_requests(id) ON DELETE CASCADE,
    sample_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (request_id, sample_id)
);

-- RLS 정책 설정 (필요시 반영)
ALTER TABLE public.kiwe_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiwe_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.kiwe_requests FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.kiwe_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public.kiwe_requests FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON public.kiwe_requests FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.kiwe_request_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.kiwe_request_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public.kiwe_request_items FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON public.kiwe_request_items FOR DELETE USING (true);
