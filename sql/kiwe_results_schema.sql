-- ============================================================
-- 분석결과 테이블 컬럼 추가 (ICP 지원)
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 기존 결과 테이블에 ICP/공통 컬럼 추가
-- (이미 컬럼이 있으면 오류가 나지 않도록 DO 블록 사용)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['kiwe_results_2026_1', 'kiwe_results_2026_2', 'kiwe_results_2025_1', 'kiwe_results_2025_2']
    LOOP
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS instrument_type TEXT', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS conc_raw NUMERIC DEFAULT 0', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS desorb_vol NUMERIC DEFAULT 1', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS dilution_factor NUMERIC DEFAULT 1', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS oxidation_corr NUMERIC DEFAULT 1', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS recovery_rate NUMERIC DEFAULT 100', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS blank1_conc NUMERIC DEFAULT 0', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS blank2_conc NUMERIC DEFAULT 0', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS result_display TEXT DEFAULT ''''', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

-- 2. 신규 결과 테이블 템플릿 (새 반기마다 이 구조로 생성)
CREATE TABLE IF NOT EXISTS kiwe_results_2026_1 (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id       TEXT NOT NULL,
    com_name        TEXT NOT NULL,
    work_process    TEXT,
    m_date          DATE NOT NULL,
    common_name     TEXT NOT NULL,
    instrument_type TEXT,                  -- 'ICP', 'GC', 'UV', '외부의뢰'

    -- 물질 스냅샷
    volume_m3          NUMERIC,
    molecular_weight   NUMERIC,
    tlv                NUMERIC,
    specific_gravity   NUMERIC,
    purity             NUMERIC,

    -- GC/UV 검량선/탈착률
    standard_slope     NUMERIC,
    standard_r2        NUMERIC,
    desorption_rate    NUMERIC,
    total_sample_volume NUMERIC,
    sample_area        NUMERIC,

    -- ICP/공통 입력값
    conc_raw           NUMERIC DEFAULT 0,   -- 기기 농도 (µg/ml)
    desorb_vol         NUMERIC DEFAULT 1,   -- 희석액 (ml)
    dilution_factor    NUMERIC DEFAULT 1,   -- 희석배수
    oxidation_corr     NUMERIC DEFAULT 1,   -- 산화보정값
    recovery_rate      NUMERIC DEFAULT 100, -- 회수율 (%)
    blank1_conc        NUMERIC DEFAULT 0,   -- 공시료1 농도
    blank2_conc        NUMERIC DEFAULT 0,   -- 공시료2 농도

    -- 한계치
    lod                NUMERIC,
    loq                NUMERIC,

    -- 결과
    result_mg          NUMERIC,
    result_mg_m3       NUMERIC,
    result_ppm         NUMERIC,
    compensated_tlv    NUMERIC,
    result_display     TEXT DEFAULT '',     -- '불검출', '검출한계미만', ''

    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sample_id, common_name)
);

-- 3. 공유저장 임시 테이블
CREATE TABLE IF NOT EXISTS kiwe_analysis_shared (
    id          BIGSERIAL PRIMARY KEY,
    share_key   TEXT NOT NULL,       -- '{hazard}_{startDate}_{endDate}'
    sample_id   TEXT NOT NULL,
    hazard      TEXT,
    data        JSONB,               -- 행 데이터 전체를 JSON으로 저장
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(share_key, sample_id)
);

ALTER TABLE kiwe_analysis_shared DISABLE ROW LEVEL SECURITY;
