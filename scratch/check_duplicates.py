import urllib.request
import json

url = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_hazard?select=*"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

print(f"Total rows in kiwe_hazard: {len(data)}")

# Find all entries with common_name containing 브롬 or 요오드
results = [h for h in data if h.get('common_name') and any(k in h['common_name'] for k in ['브롬화수소', '요오드'])]
print("Matching hazard entries in kiwe_hazard:")
for h in results:
    print(f"hazard_id: {h.get('hazard_id')}, common_name: {h.get('common_name')!r}, is_self: {h.get('is_self')!r}, inst: {h.get('instrument_name')!r}")
