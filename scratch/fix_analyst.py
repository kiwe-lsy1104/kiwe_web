import urllib.request
import json

url_base = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Fix analyst for 브롬화수소 records that were fixed earlier
# IDs 61, 66 -> 일반 시료, 외부의뢰 -> analyst = (주)SM작업환경측정센터
# IDs 67, 68 -> 공시료, 외부의뢰 -> analyst = (주)SM작업환경측정센터
analyst_updates = [
    {"id": 61, "analyst": "(주)SM작업환경측정센터"},
    {"id": 66, "analyst": "(주)SM작업환경측정센터"},
    {"id": 67, "analyst": "(주)SM작업환경측정센터"},
    {"id": 68, "analyst": "(주)SM작업환경측정센터"},
]

for item in analyst_updates:
    patch_url = f"{url_base}?id=eq.{item['id']}"
    body = {"analyst": item["analyst"]}
    req = urllib.request.Request(patch_url, data=json.dumps(body).encode('utf-8'), headers=headers, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        print(f"Updated analyst for ID {item['id']}: status {resp.status}")

# Also verify and fix 자체분석 records that have analyst=null
# Get all 2026_2 records with is_self = 자체분석 and analyst is null
check_url = f"{url_base}?select=id,common_name,is_self,analyst,sample_id&is_self=eq.자체분석&analyst=is.null"
req2 = urllib.request.Request(check_url, headers=headers)
with urllib.request.urlopen(req2) as resp2:
    nulls = json.loads(resp2.read().decode('utf-8'))
    print(f"\n자체분석이지만 analyst가 null인 레코드: {len(nulls)}건")
    for r in nulls[:10]:
        print(f"  ID: {r['id']}, {r['common_name']}, {r['sample_id']}")

print("\n완료!")
