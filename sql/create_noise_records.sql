-- ============================================================
-- 소음측정 및 보정대장 테이블 생성 스크립트
-- Table: kiwe_noise_records
-- Updated: 2026-02-20 (temp, humidity → TEXT)
-- ============================================================

CREATE TABLE IF NOT EXISTS kiwe_noise_records (
    id            BIGSERIAL PRIMARY KEY,
    m_date        DATE NOT NULL,               -- 측정일자
    com_name      TEXT NOT NULL,               -- 사업장명
    work_process  TEXT,                        -- 공정명 (단위작업장소)
    worker_name   TEXT,                        -- 작업자명
    noise_no      TEXT,                        -- 소음기 번호
    start_time    TEXT,                        -- 시작시간 (HH:MM)
    end_time      TEXT,                        -- 종료시간 (HH:MM)
    lunch_time    INTEGER DEFAULT 0,           -- 점심시간(분)
    measure_time  INTEGER,                     -- 측정시간(분) = end - start - lunch
    measured_by   TEXT,                        -- 측정자명
    temp          TEXT,                        -- 온도(℃) - 텍스트 허용 (예: 25, 20~28)
    humidity      TEXT,                        -- 습도(%) - 텍스트 허용 (예: 55, 40~60%)
    noise_result  NUMERIC(5,1),                -- 소음결과 dB(A) (소수점 1자리, 숫자 전용)
    memo          TEXT,                        -- 비고
    created_at    TIMESTAMPTZ DEFAULT NOW(),   -- 등록일시
    updated_at    TIMESTAMPTZ DEFAULT NOW()    -- 수정일시
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_noise_records_m_date ON kiwe_noise_records(m_date);
CREATE INDEX IF NOT EXISTS idx_noise_records_com_name ON kiwe_noise_records(com_name);
CREATE INDEX IF NOT EXISTS idx_noise_records_noise_result ON kiwe_noise_records(noise_result);

-- RLS(Row Level Security) 비활성화 (기존 테이블들과 동일)
ALTER TABLE kiwe_noise_records DISABLE ROW LEVEL SECURITY;
