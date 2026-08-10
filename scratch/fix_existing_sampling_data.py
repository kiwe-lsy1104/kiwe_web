import urllib.request
import json

url = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2?id=in.(61,66,67,68)"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Fetch existing ones first to see max R262 and RB262
url_all_r = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2?select=sample_id&like(sample_id,R*)&order=sample_id.desc"
req_r = urllib.request.Request(url_all_r, headers=headers)
with urllib.request.urlopen(req_r) as resp:
    r_samples = json.loads(resp.read().decode('utf-8'))
    print("Existing R/RB sample IDs:", [s['sample_id'] for s in r_samples if s.get('sample_id')])

# Update target 4 records to correct is_self and proper R/RB sample_ids if needed
# ID 61: worker 이원호 -> R262-0013
# ID 66: worker 최영규 -> R262-0014
# ID 67: worker 공시료1 -> RB262-0009
# ID 68: worker 공시료2 -> RB262-0010

updates = [
    {"id": 61, "common_name": "브롬화수소", "is_self": "(주)SM작업환경측정센터", "analyst": "(주)SM작업환경측정센터", "sample_id": "R262-0013"},
    {"id": 66, "common_name": "브롬화수소", "is_self": "(주)SM작업환경측정센터", "analyst": "(주)SM작업환경측정센터", "sample_id": "R262-0014"},
    {"id": 67, "common_name": "브롬화수소", "is_self": "(주)SM작업환경측정센터", "analyst": "(주)SM작업환경측정센터", "sample_id": "RB262-0009"},
    {"id": 68, "common_name": "브롬화수소", "is_self": "(주)SM작업환경측정센터", "analyst": "(주)SM작업환경측정센터", "sample_id": "RB262-0010"},
]

for item in updates:
    patch_url = f"https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2?id=eq.{item['id']}"
    req = urllib.request.Request(patch_url, data=json.dumps(item).encode('utf-8'), headers=headers, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        print(f"Updated ID {item['id']}: status {resp.status}")

print("Successfully cleaned up DB records!")
