import urllib.request
import json
from datetime import datetime

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
companies = query("kiwe_companies?select=com_id,com_name,manage_status")
schedules = query("kiwe_schedule?select=*")

print(f"Total records: {len(records)}")
print(f"Total companies: {len(companies)}")
print(f"Total schedules: {len(schedules)}")

# Check records for 이앤피
enp_records = [r for r in records if '이앤피' in r.get('com_name', '')]
print(f"ENP records: {len(enp_records)}")
for r in enp_records:
    print(r['id'], r['end_date'], "noise_cycle:", r.get('noise_cycle'), "excl_cycle:", r.get('noise_excl_cycle'), "next_noise:", r.get('next_noise_date'), "next_excl:", r.get('next_excl_date'))

todayStr = "2026-10-28" # Current date in system prompt: 2026-10-28

# Let's run the exact logic from plan.js
def simulate_plan(rec_list, target_todayStr):
    companyStatusMap = {c['com_id']: c.get('manage_status') for c in companies}
    plans = []
    for rec in rec_list:
        isSuspended = False
        if rec.get('com_id') and companyStatusMap.get(rec['com_id']):
            if companyStatusMap[rec['com_id']] == '관리중지':
                isSuspended = True
        else:
            comp = next((c for c in companies if c['com_name'].replace('(주)','').replace('㈜','').strip() == rec['com_name'].replace('(주)','').replace('㈜','').strip()), None)
            if comp and comp.get('manage_status') == '관리중지':
                isSuspended = True
        
        if isSuspended:
            continue
            
        dates = []
        if rec.get('next_noise_date'): dates.append(rec['next_noise_date'])
        if rec.get('next_excl_date'): dates.append(rec['next_excl_date'])
        dates.sort()
        
        repDate = None
        futureDates = [d for d in dates if d >= target_todayStr]
        if futureDates:
            repDate = futureDates[0]
        elif dates:
            repDate = dates[0]
            
        if not repDate:
            continue
            
        plans.append({
            'id': rec['id'],
            'com_name': rec['com_name'],
            'rep_date': repDate,
            'end_date': rec.get('end_date')
        })
        
    plans.sort(key=lambda x: x['rep_date'], reverse=True)
    
    uniquePlans = []
    seenCom = set()
    for p in plans:
        if p['com_name'] not in seenCom:
            seenCom.add(p['com_name'])
            uniquePlans.append(p)
            
    return uniquePlans

print("\n--- Simulation 1: Current situation (with 2026-10-27 record id:943) on today 2026-10-28 ---")
plans_now = simulate_plan(records, "2026-10-28")
enp_plan_now = [p for p in plans_now if '이앤피' in p['com_name']]
print("ENP in current plan:", enp_plan_now)

print("\n--- Simulation 2: Before 2026-10-27 (excluding id:943, say on 2026-10-15) ---")
records_before = [r for r in records if r['id'] != 943]
plans_before = simulate_plan(records_before, "2026-10-15")
enp_plan_before = [p for p in plans_before if '이앤피' in p['com_name']]
print("ENP in before plan on 2026-10-15:", enp_plan_before)

print("\n--- Simulation 3: Check all plans that were generated from records for ENP before id:943 ---")
# What were the raw plans for ENP before deduplication?
for r in [r for r in records_before if '이앤피' in r['com_name']]:
    dates = []
    if r.get('next_noise_date'): dates.append(r['next_noise_date'])
    if r.get('next_excl_date'): dates.append(r['next_excl_date'])
    dates.sort()
    print("Rec id:", r['id'], "end_date:", r['end_date'], "dates:", dates)
