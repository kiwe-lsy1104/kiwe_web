import urllib.request
import urllib.parse
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

print("--- KIWE_RECORDS ---")
encoded_q = urllib.parse.quote('이앤피')
records = query(f"kiwe_records?com_name=ilike.*{encoded_q}*&select=*")
print(f"Found {len(records)} records for 이앤피:")
for r in records:
    print({
        'id': r.get('id'),
        'com_id': r.get('com_id'),
        'com_name': r.get('com_name'),
        'start_date': r.get('start_date'),
        'end_date': r.get('end_date'),
        'noise_cycle': r.get('noise_cycle'),
        'noise_excl_cycle': r.get('noise_excl_cycle'),
        'next_noise_date': r.get('next_noise_date'),
        'next_excl_date': r.get('next_excl_date'),
        'inspector': r.get('inspector'),
        'created_at': r.get('created_at')
    })

print("\n--- KIWE_COMPANIES ---")
companies = query(f"kiwe_companies?com_name=ilike.*{encoded_q}*&select=*")
print(f"Found {len(companies)} companies for 이앤피:")
for c in companies:
    print({
        'com_id': c.get('com_id'),
        'com_name': c.get('com_name'),
        'manage_status': c.get('manage_status'),
        'manage_remark': c.get('manage_remark')
    })
