-- 2026년 견적번호와 내부 숫자가 맞지 않는 데이터를 동기화합니다.
UPDATE kiwe_quotations
SET quote_seq = (regexp_match(quote_no, '(\d+)$'))[1]::integer
WHERE year = 2026 
  AND quote_no ~ '(\d+)$'
  AND (quote_seq != (regexp_match(quote_no, '(\d+)$'))[1]::integer OR quote_seq IS NULL);

-- 확인용 쿼리
SELECT id, quote_no, quote_seq 
FROM kiwe_quotations 
WHERE year = 2026 
ORDER BY quote_seq DESC;
