import xlrd

def auto_fix_biff_externsheet(data: bytes) -> bytes:
    if len(data) < 512 or data[:4] != b'\xD0\xCF\x11\xE0':
        return data
    buf = bytearray(data)
    i = 0
    while i < len(buf) - 8:
        if buf[i] == 0x17 and buf[i+1] == 0x00 and buf[i+2] == 0x08 and buf[i+3] == 0x00:
            cxt = buf[i+4] | (buf[i+5] << 8)
            if cxt > 1:
                buf[i+4] = 0x01
                buf[i+5] = 0x00
            i += 11
        else:
            i += 1
    return bytes(buf)

with open(r"c:\Users\lee seung yong\OneDrive\바탕 화면\kiwe_web\용인세브란스병원(별도)_2026_하반기.xls", 'rb') as f:
    raw = f.read()

fixed = auto_fix_biff_externsheet(raw)
wb = xlrd.open_workbook(file_contents=fixed, formatting_info=False)
sheet = wb.sheet_by_index(0)

grid = []
for r in range(sheet.nrows):
    grid.append([str(sheet.cell_value(r, c)).strip() for c in range(sheet.ncols)])

headerRowIdx = 0
COL = {'measureDate': 0, 'proc': 2, 'hazard': 5, 'location': 16, 'workerName': 18, 'deviceNo': 6, 'calNo': 30, 'sampleId': 7}

rows = []
lastProc, lastWorker, lastLocation, lastSampleId = '', '', '', ''

for r in range(headerRowIdx + 1, len(grid)):
    row = grid[r]
    hazardRaw = row[COL['hazard']] if COL['hazard'] < len(row) else ''
    if not hazardRaw:
        break
    hazardClean = hazardRaw.strip()
    isNoise = '소음' in hazardClean

    rawProc = row[COL['proc']] if COL['proc'] < len(row) else ''
    rawWorker = row[COL['workerName']] if COL['workerName'] < len(row) else ''
    rawLoc = row[COL['location']] if COL['location'] < len(row) else ''
    rawSid = row[COL['sampleId']] if COL['sampleId'] < len(row) else ''

    proc = rawProc or lastProc
    worker = rawWorker or lastWorker
    loc = rawLoc or lastLocation

    if isNoise:
        sampleId = ''
    else:
        if rawSid:
            sampleId = rawSid
            lastSampleId = rawSid
        else:
            if (rawProc and lastProc and rawProc != lastProc) or (rawWorker and lastWorker and rawWorker != lastWorker):
                lastSampleId = ''
            sampleId = lastSampleId

    lastProc, lastWorker, lastLocation = proc, worker, loc
    rows.append({
        'proc': proc, 'hazard': hazardClean, 'workerName': worker,
        'location': loc, 'sampleId': sampleId, 'isNoise': isNoise
    })

# Span calculation
pageRows = [{**r, 'procSpan': 0, 'workerSpan': 0, 'sampleSpan': 0} for r in rows]

# proc span
pStart = 0
while pStart < len(pageRows):
    pEnd = pStart + 1
    while pEnd < len(pageRows) and pageRows[pEnd]['proc'] == pageRows[pStart]['proc']:
        pEnd += 1
    pageRows[pStart]['procSpan'] = pEnd - pStart
    pStart = pEnd

# worker span
wStart = 0
while wStart < len(pageRows):
    wKey = f"{pageRows[wStart]['workerName']}__{pageRows[wStart]['location']}"
    wEnd = wStart + 1
    while wEnd < len(pageRows) and f"{pageRows[wEnd]['workerName']}__{pageRows[wEnd]['location']}" == wKey:
        wEnd += 1
    pageRows[wStart]['workerSpan'] = wEnd - wStart
    wStart = wEnd

# sample span
sStart = 0
while sStart < len(pageRows):
    rStart = pageRows[sStart]
    sid = rStart['sampleId'].strip()
    if rStart['isNoise'] or not sid:
        pageRows[sStart]['sampleSpan'] = 1
        sStart += 1
        continue
    sEnd = sStart + 1
    while (sEnd < len(pageRows) and not pageRows[sEnd]['isNoise'] and
           pageRows[sEnd]['proc'] == rStart['proc'] and
           pageRows[sEnd]['workerName'] == rStart['workerName'] and
           pageRows[sEnd]['location'] == rStart['location'] and
           pageRows[sEnd]['sampleId'].strip() == sid):
        sEnd += 1
    pageRows[sStart]['sampleSpan'] = sEnd - sStart
    sStart = sEnd

for i, r in enumerate(pageRows):
    print(f"Row {i:2d}: procSpan={r['procSpan']}, workerSpan={r['workerSpan']}, sampleSpan={r['sampleSpan']}")
