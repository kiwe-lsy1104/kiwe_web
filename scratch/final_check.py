import urllib.request
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

url_base = "https://jztrnwchgxymknjvsbkl.supabase.co/rest/v1/kiwe_sampling_2026_2"
headers = {
    "apikey": "sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
    "Authorization": "Bearer sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33",
}

all_url = f"{url_base}?select=id,sample_id,common_name,is_self,analyst,instrument_name"
req = urllib.request.Request(all_url, headers=headers)
with urllib.request.urlopen(req) as resp:
    all_records = json.loads(resp.read().decode('utf-8'))

print(f"Total 2026_2 records: {len(all_records)}")

issues = []
for r in all_records:
    sid = r.get('sample_id') or ''
    is_self = r.get('is_self') or ''
    analyst = r.get('analyst') or ''
    common = r.get('common_name') or ''
    
    problems = []
    if not analyst:
        problems.append("analyst 빈값")
    if sid and is_self:
        if is_self == '자체분석' and sid.startswith('R'):
            problems.append(f"자체분석인데 R prefix: {sid}")
        elif is_self != '자체분석' and is_self and (sid.startswith('S') or sid.startswith('D')):
            problems.append(f"외부기관인데 S/D prefix: {sid}")
    if analyst and is_self and is_self != '자체분석' and analyst in ['이초롱']:
        problems.append(f"외부기관인데 analyst=이초롱")
    
    if problems:
        issues.append(f"ID:{r['id']} [{common}] {sid} | is_self:{is_self!r} | analyst:{analyst!r} | {' / '.join(problems)}")

if issues:
    print(f"이슈 발견 ({len(issues)}건):")
    for i in issues:
        print(f"  {i}")
else:
    print("모든 레코드 정상! is_self / 시료번호 / analyst 일치")

print()
analyst_null = [r for r in all_records if not r.get('analyst')]
print(f"analyst 빈값: {len(analyst_null)}건")
r_prefix = [r for r in all_records if (r.get('sample_id') or '').startswith('R')]
s_prefix = [r for r in all_records if (r.get('sample_id') or '').startswith('S')]
d_prefix = [r for r in all_records if (r.get('sample_id') or '').startswith('D')]
no_sid   = [r for r in all_records if not r.get('sample_id')]
print(f"R 시료: {len(r_prefix)}건, S 시료: {len(s_prefix)}건, D 시료: {len(d_prefix)}건, 시료번호없음: {len(no_sid)}건")
