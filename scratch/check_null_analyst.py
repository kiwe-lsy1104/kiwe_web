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

# Check 자체분석 records with analyst=null
# Use proper URL encoding for Korean characters
is_self_val = urllib.parse.quote("자체분석")
check_url = f"{url_base}?select=id,common_name,is_self,analyst,sample_id&is_self=eq.{is_self_val}&analyst=is.null"
req2 = urllib.request.Request(check_url, headers=headers)
with urllib.request.urlopen(req2) as resp2:
    nulls = json.loads(resp2.read().decode('utf-8'))
    print(f"자체분석이지만 analyst가 null인 레코드: {len(nulls)}건")
    for r in nulls:
        print(f"  ID: {r['id']}, common: {r['common_name']!r}, sample_id: {r['sample_id']}")
