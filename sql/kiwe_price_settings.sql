-- ============================================
-- kiwe_price_settings: 연도별 단가 설정 테이블
-- ============================================
-- [마이그레이션] 2026-03: sub_category, method_name 컬럼 추가
-- Supabase SQL Editor에서 아래 두 줄을 실행하세요:
--   ALTER TABLE kiwe_price_settings ADD COLUMN IF NOT EXISTS sub_category TEXT DEFAULT NULL;
--   ALTER TABLE kiwe_price_settings ADD COLUMN IF NOT EXISTS method_name TEXT DEFAULT NULL;
CREATE TABLE IF NOT EXISTS kiwe_price_settings (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  price_type TEXT NOT NULL DEFAULT '일반',
  -- '일반', '비용지원', '엔지니어링'
  category TEXT NOT NULL,
  -- '기본관리비', '분석수수료', '엔지니어링노임', '인당단가', '장비대여'
  item_name TEXT NOT NULL,
  item_code TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  support_rate NUMERIC DEFAULT 0,
  -- 비용지원단가 전용: 지원비율 (%)
  support_amount NUMERIC DEFAULT 0,
  -- 비용지원단가 전용: 지원금액
  sort_order INTEGER DEFAULT 0,
  is_fixed BOOLEAN DEFAULT false,
  -- true: 삭제 불가 고정 항목
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, price_type, category, item_name)
);

ALTER TABLE kiwe_price_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kiwe_price_settings_all" ON kiwe_price_settings
  FOR ALL USING (true) WITH CHECK (true);

-- 기본 단가 데이터 (2025년 기준)
INSERT INTO kiwe_price_settings (year, price_type, category, item_name, item_code, unit_price, sort_order, is_fixed)
VALUES
-- ===== 일반단가: 기본관리비 =====
(2025, '일반', '기본관리비', '1~49인', 'MGT-01', 714000, 1, true),
(2025, '일반', '기본관리비', '50~99인', 'MGT-02', 1112000, 2, true),
(2025, '일반', '기본관리비', '100~299인', 'MGT-03', 1752000, 3, true),
(2025, '일반', '기본관리비', '300~499인', 'MGT-04', 2577000, 4, true),
(2025, '일반', '기본관리비', '500~999인', 'MGT-05', 3070000, 5, true),
(2025, '일반', '기본관리비', '1000~1999인', 'MGT-06', 3326000, 6, true),
(2025, '일반', '기본관리비', '2000~2999인', 'MGT-07', 3913000, 7, true),
(2025, '일반', '기본관리비', '3000인 이상', 'MGT-08', 4503000, 8, true),

-- ===== 일반단가: 분석수수료 =====
(2025, '일반', '분석수수료', '중량분석법(분진)', 'ANA-01', 57000, 1, false),
(2025, '일반', '분석수수료', '중량분석법(호흡성)', 'ANA-02', 57600, 2, false),
(2025, '일반', '분석수수료', '중량분석법(흡입성)', 'ANA-03', 57900, 3, false),
(2025, '일반', '분석수수료', 'ICP법', 'ANA-04', 176200, 4, false),
(2025, '일반', '분석수수료', 'GC법(다성분)', 'ANA-05', 136500, 5, false),
(2025, '일반', '분석수수료', 'GC법(단성분)', 'ANA-06', 110000, 6, false),
(2025, '일반', '분석수수료', 'HPLC법(다성분)', 'ANA-07', 125600, 7, false),
(2025, '일반', '분석수수료', 'HPLC법(단성분)', 'ANA-08', 110300, 8, false),
(2025, '일반', '분석수수료', 'IC법(다성분)', 'ANA-09', 160300, 9, false),
(2025, '일반', '분석수수료', 'IC법(단성분)', 'ANA-10', 127500, 10, false),
(2025, '일반', '분석수수료', '여과-IC법(다성분)', 'ANA-11', 151100, 11, false),
(2025, '일반', '분석수수료', '여과-IC법(단성분)', 'ANA-12', 149500, 12, false),
(2025, '일반', '분석수수료', '흡광광도법', 'ANA-13', 90300, 13, false),
(2025, '일반', '분석수수료', '여과-흡광광도법', 'ANA-14', 100100, 14, false),
(2025, '일반', '분석수수료', 'FTIR법', 'ANA-15', 111600, 15, false),
(2025, '일반', '분석수수료', '추출법', 'ANA-16', 93000, 16, false),
(2025, '일반', '분석수수료', 'GC/MS(정성)', 'ANA-17', 438000, 17, false),
(2025, '일반', '분석수수료', '소음노출량계', 'ANA-18', 33800, 18, false),
(2025, '일반', '분석수수료', 'WBGT측정기', 'ANA-19', 37100, 19, false),
(2025, '일반', '분석수수료', '전기화학식센서법', 'ANA-20', 25000, 20, false),
(2025, '일반', '분석수수료', '조도계', 'ANA-21', 8500, 21, false),
(2025, '일반', '분석수수료', '비분산적외선법(Co)', 'ANA-22', 70000, 22, false),
(2025, '일반', '분석수수료', '비분산적외선법(Co2)', 'ANA-23', 69800, 23, false),

-- ===== 일반단가: 엔지니어링노임 =====
(2025, '일반', '엔지니어링노임', '기술사', 'ENG-01', 447658, 1, true),
(2025, '일반', '엔지니어링노임', '특급기술자', 'ENG-02', 357676, 2, true),
(2025, '일반', '엔지니어링노임', '고급기술자', 'ENG-03', 301863, 3, true),
(2025, '일반', '엔지니어링노임', '중급기술자', 'ENG-04', 261545, 4, true),
(2025, '일반', '엔지니어링노임', '초급기술자', 'ENG-05', 229278, 5, true),

-- ===== 비용지원단가: 기본관리비 =====
(2025, '비용지원', '기본관리비', '비용지원대상', 'SUP-MGT-01', 390490, 1, true),

-- ===== 비용지원단가: 분석수수료 (일반단가 기준, 지원비율/금액 별도 설정) =====
(2025, '비용지원', '분석수수료', '중량분석법(분진)', 'SUP-ANA-01', 57000, 1, false),
(2025, '비용지원', '분석수수료', '중량분석법(호흡성)', 'SUP-ANA-02', 57600, 2, false),
(2025, '비용지원', '분석수수료', '중량분석법(흡입성)', 'SUP-ANA-03', 57900, 3, false),
(2025, '비용지원', '분석수수료', 'ICP법', 'SUP-ANA-04', 176200, 4, false),
(2025, '비용지원', '분석수수료', 'GC법(다성분)', 'SUP-ANA-05', 136500, 5, false),
(2025, '비용지원', '분석수수료', 'GC법(단성분)', 'SUP-ANA-06', 110000, 6, false),
(2025, '비용지원', '분석수수료', 'HPLC법(다성분)', 'SUP-ANA-07', 125600, 7, false),
(2025, '비용지원', '분석수수료', 'HPLC법(단성분)', 'SUP-ANA-08', 110300, 8, false),
(2025, '비용지원', '분석수수료', 'IC법(다성분)', 'SUP-ANA-09', 160300, 9, false),
(2025, '비용지원', '분석수수료', 'IC법(단성분)', 'SUP-ANA-10', 127500, 10, false),
(2025, '비용지원', '분석수수료', '여과-IC법(다성분)', 'SUP-ANA-11', 151100, 11, false),
(2025, '비용지원', '분석수수료', '여과-IC법(단성분)', 'SUP-ANA-12', 149500, 12, false),
(2025, '비용지원', '분석수수료', '흡광광도법', 'SUP-ANA-13', 90300, 13, false),
(2025, '비용지원', '분석수수료', '여과-흡광광도법', 'SUP-ANA-14', 100100, 14, false),
(2025, '비용지원', '분석수수료', 'FTIR법', 'SUP-ANA-15', 111600, 15, false),
(2025, '비용지원', '분석수수료', '추출법', 'SUP-ANA-16', 93000, 16, false),
(2025, '비용지원', '분석수수료', '소음노출량계', 'SUP-ANA-17', 33800, 17, false),
(2025, '비용지원', '분석수수료', 'WBGT측정기', 'SUP-ANA-18', 37100, 18, false),
(2025, '비용지원', '분석수수료', '전기화학식센서법', 'SUP-ANA-19', 25000, 19, false),
(2025, '비용지원', '분석수수료', '조도계', 'SUP-ANA-20', 8500, 20, false),
(2025, '비용지원', '분석수수료', '비분산적외선법(Co)', 'SUP-ANA-21', 70000, 21, false),
(2025, '비용지원', '분석수수료', '비분산적외선법(Co2)', 'SUP-ANA-22', 69800, 22, false),

-- ===== 엔지니어링단가: 엔지니어링 기타부문 노임단가 =====
(2025, '엔지니어링', '엔지니어링노임', '기술사', 'EENG-01', 447658, 1, true),
(2025, '엔지니어링', '엔지니어링노임', '특급기술자', 'EENG-02', 357676, 2, true),
(2025, '엔지니어링', '엔지니어링노임', '고급기술자', 'EENG-03', 301863, 3, true),
(2025, '엔지니어링', '엔지니어링노임', '중급기술자', 'EENG-04', 261545, 4, true),
(2025, '엔지니어링', '엔지니어링노임', '초급기술자', 'EENG-05', 229278, 5, true),

-- ===== 엔지니어링단가: 인당 단가 =====
(2025, '엔지니어링', '인당단가', '인당', 'EENG-P01', 20000, 1, true),

-- ===== 엔지니어링단가: 장비대여 =====
(2025, '엔지니어링', '장비대여', 'ME20', 'EENG-EQ01', 10000, 1, true),
(2025, '엔지니어링', '장비대여', 'ME20-EX7L', 'EENG-EQ02', 10000, 2, true),
(2025, '엔지니어링', '장비대여', 'GilAir Plus', 'EENG-EQ03', 10000, 3, true),
(2025, '엔지니어링', '장비대여', 'Gilian LFS-113DC', 'EENG-EQ04', 10000, 4, true),
(2025, '엔지니어링', '장비대여', 'Edge 4P', 'EENG-EQ05', 15000, 5, true)

ON CONFLICT (year, price_type, category, item_name) DO NOTHING;

-- ============================================================
-- [마이그레이션 후] sub_category / method_name 업데이트
-- 엔지니어링 노임단가 항목에 sub_category 세팅
-- ============================================================
/*
UPDATE kiwe_price_settings SET sub_category = '엔지니어링 기타부문 노임단가' WHERE price_type='엔지니어링' AND category='엔지니어링노임';
UPDATE kiwe_price_settings SET sub_category = '인당 단가', method_name = '인당 단가' WHERE price_type='엔지니어링' AND category='인당단가';
UPDATE kiwe_price_settings SET sub_category = '장비대여', method_name = '고유량펌프' WHERE price_type='엔지니어링' AND category='장비대여' AND item_name IN ('ME20','ME20-EX7L','GilAir Plus','Gilian LFS-113DC');
UPDATE kiwe_price_settings SET sub_category = '장비대여', method_name = '소음노출량계' WHERE price_type='엔지니어링' AND category='장비대여' AND item_name = 'Edge 4P';
*/
