-- ============================================================
-- 시료채취대장 input_seq 전체 일괄 재부여 스크립트 (동적 버전)
--
-- 목적:
--   kiwe_sampling_* 패턴의 모든 테이블을 자동으로 감지하여
--   전체 통합 기준 id 오름차순으로 input_seq = 1, 2, 3, ... 부여
--
-- 특징:
--   - 테이블명을 하드코딩하지 않음 → 신규 테이블(kiwe_sampling_2026_2 등)
--     이 생겨도 스크립트 수정 없이 바로 적용 가능
--   - 기존 input_seq 값은 전부 덮어씀 (클린 슬레이트)
--
-- 실행 방법:
--   Supabase SQL Editor에 전체 붙여넣고 실행하세요.
-- ============================================================

DO $$
DECLARE
    v_sql        TEXT;
    v_union_sql  TEXT := '';
    v_table      TEXT;
    v_first      BOOLEAN := TRUE;
    rec          RECORD;
    v_seq        INTEGER := 0;
    v_id         BIGINT;
    v_tbl        TEXT;
    v_count      INTEGER := 0;
BEGIN
    -- ── STEP 1: pg_tables에서 kiwe_sampling_* 테이블 목록을 가져와
    --            동적으로 UNION ALL 쿼리를 조립합니다.
    FOR v_table IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'kiwe_sampling_%'
        ORDER BY tablename  -- 테이블명 오름차순 = 연대순 (2025_1 → 2025_2 → 2026_1 → ...)
    LOOP
        IF v_first THEN
            v_union_sql := format(
                'SELECT %L::TEXT AS tbl, id FROM %I',
                v_table, v_table
            );
            v_first := FALSE;
        ELSE
            v_union_sql := v_union_sql || format(
                ' UNION ALL SELECT %L::TEXT, id FROM %I',
                v_table, v_table
            );
        END IF;
        RAISE NOTICE '대상 테이블 감지: %', v_table;
    END LOOP;

    IF v_first THEN
        RAISE EXCEPTION 'kiwe_sampling_* 테이블을 하나도 찾을 수 없습니다.';
    END IF;

    -- ── STEP 2: 통합된 모든 행을 id 오름차순으로 순회하며 input_seq 부여
    v_sql := 'SELECT tbl, id FROM (' || v_union_sql || ') combined ORDER BY id ASC';

    FOR rec IN EXECUTE v_sql
    LOOP
        v_seq   := v_seq + 1;
        v_tbl   := rec.tbl;
        v_id    := rec.id;
        v_count := v_count + 1;

        EXECUTE format(
            'UPDATE %I SET input_seq = %s WHERE id = %s',
            v_tbl, v_seq, v_id
        );
    END LOOP;

    RAISE NOTICE '=== 완료: 총 % 건에 input_seq 1 ~ % 부여 ===', v_count, v_seq;
END $$;


-- ────────────────────────────────────────────────────────────
-- 결과 검증 쿼리 (DO 블록 실행 후 아래를 별도로 실행하세요)
-- ────────────────────────────────────────────────────────────

-- 1) 테이블별 통계 (null 잔존 여부, min/max 확인)
SELECT
    tablename                                           AS 테이블,
    (xpath('/row/c/text()',
        query_to_xml(format('SELECT COUNT(*) AS c FROM %I', tablename), false, true, '')
    ))[1]::TEXT::BIGINT                                AS 전체건수,
    (xpath('/row/c/text()',
        query_to_xml(format('SELECT COALESCE(MIN(input_seq),0) AS c FROM %I', tablename), false, true, '')
    ))[1]::TEXT::BIGINT                                AS 최소순번,
    (xpath('/row/c/text()',
        query_to_xml(format('SELECT COALESCE(MAX(input_seq),0) AS c FROM %I', tablename), false, true, '')
    ))[1]::TEXT::BIGINT                                AS 최대순번,
    (xpath('/row/c/text()',
        query_to_xml(format('SELECT COUNT(*) AS c FROM %I WHERE input_seq IS NULL', tablename), false, true, '')
    ))[1]::TEXT::BIGINT                                AS NULL건수
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'kiwe_sampling_%'
ORDER BY tablename;
