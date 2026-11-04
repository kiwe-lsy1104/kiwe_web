import urllib.request
import json

base_url = 'https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1'
headers = {
    'apikey': 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33',
    'Authorization': 'Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33'
}

def query(endpoint):
    req = urllib.request.Request(f"{base_url}/{endpoint}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

records = query("kiwe_records?select=*&order=end_date.desc")
companies = query("kiwe_companies?select=*")
schedules = query("kiwe_schedule?select=*")

enp_recs = [r for r in records if '이앤피' in r.get('com_name', '')]
print(f"=== ENP RECORDS ({len(enp_recs)}) ===")
for r in enp_recs:
    print(r)

enp_scheds = [s for s in schedules if '이앤피' in s.get('com_name', '')]
print(f"\n=== ENP SCHEDULES ({len(enp_scheds)}) ===")
for s in enp_scheds:
    print(s)

enp_comps = [c for c in companies if '이앤피' in c.get('com_name', '')]
print(f"\n=== ENP COMPANIES ({len(enp_comps)}) ===")
for c in enp_comps:
    print(c)
