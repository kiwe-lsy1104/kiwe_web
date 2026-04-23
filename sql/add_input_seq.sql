-- 시료채취대장 순번(input_seq) 컬럼 추가 및 기존 데이터 마이그레이션
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE tablename LIKE 'kiwe_sampling_%') 
    LOOP
        -- 1. 컬럼 추가 (이미 있으면 무시)
        EXECUTE 'ALTER TABLE ' || t || ' ADD COLUMN IF NOT EXISTS input_seq INTEGER';
        
        -- 2. 기존 데이터의 input_seq를 id 값으로 초기화 (최초 1회)
        -- input_seq가 null인 경우에만 수행
        EXECUTE 'UPDATE ' || t || ' SET input_seq = id WHERE input_seq IS NULL';
        
        RAISE NOTICE 'Updated table: %', t;
    END LOOP;
END $$;
