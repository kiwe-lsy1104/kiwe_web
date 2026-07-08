-- kiwe_flow 테이블에 유량 측정값 컬럼 추가
ALTER TABLE kiwe_flow
    ADD COLUMN IF NOT EXISTS pre_flow_1  NUMERIC(10, 3),
    ADD COLUMN IF NOT EXISTS pre_flow_2  NUMERIC(10, 3),
    ADD COLUMN IF NOT EXISTS pre_flow_3  NUMERIC(10, 3),
    ADD COLUMN IF NOT EXISTS post_flow_1 NUMERIC(10, 3),
    ADD COLUMN IF NOT EXISTS post_flow_2 NUMERIC(10, 3),
    ADD COLUMN IF NOT EXISTS post_flow_3 NUMERIC(10, 3);
