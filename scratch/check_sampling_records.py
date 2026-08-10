import urllib.request
import json
import sys

url = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2?select=sample_id,common_name,is_self,instrument_name,m_date,worker_name&limit=1000"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

with open('scratch/sampling_2026_2_dump.txt', 'w', encoding='utf-8') as f:
    for r in data:
        c = str(r.get('common_name'))
        if any(t in c for t in ['브롬화수소', '요오드', '브롬']):
            f.write(f"ID: {r.get('sample_id')} | Common: '{c}' | is_self: '{r.get('is_self')}' | inst: '{r.get('instrument_name')}' | date: {r.get('m_date')} | worker: '{r.get('worker_name')}'\n")

print("Written to scratch/sampling_2026_2_dump.txt")
