import urllib.request
import json

url = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_hazard?select=hazard_id,common_name,is_self,instrument_name"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

is_self_counts = {}
for h in data:
    val = h.get('is_self')
    is_self_counts[val] = is_self_counts.get(val, 0) + 1

print("Distinct is_self values:", is_self_counts)

print("\n--- Hazards with is_self == '자체분석' ---")
for h in data:
    if h.get('is_self') == '자체분석':
        print(h)

print("\n--- Hazards with '브롬' or '요오드' or '수소' ---")
for h in data:
    c = str(h.get('common_name'))
    if any(k in c for k in ['브롬', '요오드', '수소']):
        print(h)
