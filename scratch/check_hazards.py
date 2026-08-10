import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_hazard?select=*"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

print(f"Total hazards: {len(data)}")

# Let's inspect hazards related to 브롬 or 요오드 or all hazards
with open('scratch/hazards_dump.txt', 'w', encoding='utf-8') as f:
    for item in data:
        cname = str(item.get('common_name'))
        lname = str(item.get('legal_name'))
        is_self = str(item.get('is_self'))
        inst = str(item.get('instrument_name'))
        f.write(f"ID: {item.get('hazard_id')} | Common: '{cname}' | Legal: '{lname}' | is_self: '{is_self}' | Inst: '{inst}'\n")

print("Dumped all hazards to scratch/hazards_dump.txt")
