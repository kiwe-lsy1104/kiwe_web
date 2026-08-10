import urllib.request
import json
import urllib.parse

url_base = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# 자체분석이면 이초롱, 외부기관이면 기관명으로 analyst 일괄 업데이트
# 먼저 전체 레코드 조회
all_url = f"{url_base}?select=id,is_self,analyst"
req = urllib.request.Request(all_url, headers=headers)
with urllib.request.urlopen(req) as resp:
    all_records = json.loads(resp.read().decode('utf-8'))

print(f"Total records: {len(all_records)}")

# analyst가 null인 것만 필터
to_fix = [r for r in all_records if r.get('analyst') is None and r.get('is_self')]

print(f"analyst가 null인 레코드: {len(to_fix)}건")

fixed = 0
for r in to_fix:
    is_self = r.get('is_self', '')
    if is_self == '자체분석':
        analyst_val = '이초롱'
    elif is_self:
        analyst_val = is_self
    else:
        analyst_val = '이초롱'
    
    patch_url = f"{url_base}?id=eq.{r['id']}"
    body = {"analyst": analyst_val}
    req_patch = urllib.request.Request(patch_url, data=json.dumps(body).encode('utf-8'), headers=headers, method='PATCH')
    with urllib.request.urlopen(req_patch) as resp_p:
        fixed += 1

print(f"총 {fixed}건 analyst 보정 완료!")
