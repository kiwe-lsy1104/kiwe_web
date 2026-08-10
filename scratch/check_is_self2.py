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

with open('scratch/is_self_summary.txt', 'w', encoding='utf-8') as f:
    counts = {}
    for h in data:
        val = h.get('is_self')
        counts[val] = counts.get(val, 0) + 1
    f.write(f"Distinct values: {counts}\n\n")

    f.write("All Hazards List:\n")
    for h in data:
        f.write(f"{h.get('hazard_id')} | {h.get('common_name')} | {h.get('is_self')} | {h.get('instrument_name')}\n")

print("Done summary to scratch/is_self_summary.txt")
