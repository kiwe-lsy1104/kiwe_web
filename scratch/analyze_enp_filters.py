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

# Let's inspect rec 814
r814 = next(r for r in records if r['id'] == 814)
print("r814 inspector:", r814['inspector'])
print("r814 rep_inspector:", (r814['inspector'] or '').split(',')[0].strip())

# Check schedule matching for 814
repDate = '2026-10-22'
repD = datetime.strptime(repDate, '%Y-%m-%d')

for s in schedules:
    norm_s = s['com_name'].replace('(주)','').replace('㈜','').strip()
    norm_r = r814['com_name'].replace('(주)','').replace('㈜','').strip()
    if norm_s == norm_r:
        sDate = datetime.strptime(s['sche_date'], '%Y-%m-%d')
        diff_days = abs((sDate - repD).days)
        print("Schedule found:", s['id'], s['sche_date'], s['com_name'], "diff_days:", diff_days, "matched (<45):", diff_days < 45)

# Notice schedule 338: sche_date 2026-10-27!
# diff between 2026-10-22 and 2026-10-27 is 5 days!
# So diff_days < 45 is True!
# Therefore, confirmedSchedule was FOUND!
# Which means status was '확정' (Confirmed)!

print("\n--- Testing Filter conditions on r814 ---")
# If status was '확정':
# 1. filterStatus:
#    If filterStatus == '전체': passes
#    If filterStatus == '예정': DOES NOT PASS! Because status is '확정'!
#    If filterStatus == '확정': passes
# 2. filterInspector:
#    rep_inspector is '강경호'
#    If filterInspector == '전체': passes
#    If filterInspector == '이승용': DOES NOT PASS!
# 3. filterMonth:
#    rep_date is '2026-10-22', month is '10'
#    If filterMonth == '10': passes
#    If filterMonth == '전체': passes
# 4. filterHalf:
#    Month is 10 (>= 6) -> 하반기
#    If filterHalf == '하반기' or '전체': passes
#    If filterHalf == '상반기': DOES NOT PASS!

print("\n--- Now let's check what happened when id:943 was inserted on 2026-10-25 ---")
r943 = next(r for r in records if r['id'] == 943)
print("r943 rep_date:", r943['next_noise_date'], r943['next_excl_date'])
