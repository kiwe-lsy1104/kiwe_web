import urllib.request
import json

url = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2?select=*&limit=1000"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

with open('scratch/sampling_2026_2_full.json', 'w', encoding='utf-8') as f:
    targets = ['브롬화수소', '요오드']
    found = [r for r in data if any(t in str(r.get('common_name')) for t in targets)]
    json.dump(found, f, ensure_ascii=False, indent=2)

print("Saved detailed records to scratch/sampling_2026_2_full.json")
