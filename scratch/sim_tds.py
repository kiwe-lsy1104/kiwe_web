order = [
    'no', 'proc', 'workerName', 'location', 'hazard',
    'deviceNo', 'calNo', 'sampleId',
    'flowBefore', 'flowAfter', 'startTime', 'endTime', 'remark'
]

COLUMNS_DEF = {
    'no':         { 'id': 'no',         'isGroupSpan': None },
    'proc':       { 'id': 'proc',       'isGroupSpan': 'proc' },
    'workerName': { 'id': 'workerName', 'isGroupSpan': 'worker' },
    'location':   { 'id': 'location',   'isGroupSpan': 'worker' },
    'hazard':     { 'id': 'hazard',     'isGroupSpan': None },
    'deviceNo':   { 'id': 'deviceNo',   'isGroupSpan': 'sample', 'isBlankHandwriting': True },
    'calNo':      { 'id': 'calNo',      'isGroupSpan': 'sample', 'isBlankHandwriting': True },
    'sampleId':   { 'id': 'sampleId',   'isGroupSpan': 'sample' },
    'flowBefore': { 'id': 'flowBefore', 'isGroupSpan': 'sample', 'isBlankHandwriting': True },
    'flowAfter':  { 'id': 'flowAfter',  'isGroupSpan': 'sample', 'isBlankHandwriting': True },
    'startTime':  { 'id': 'startTime',  'isGroupSpan': 'sample', 'isBlankHandwriting': True },
    'endTime':    { 'id': 'endTime',    'isGroupSpan': 'sample', 'isBlankHandwriting': True },
    'remark':     { 'id': 'remark',     'isGroupSpan': None },
}

test_rows = [
    {'globalNo': 1, 'procSpan': 9, 'workerSpan': 3, 'sampleSpan': 3, 'proc': '공정', 'workerName': 'W', 'location': 'L', 'hazard': 'H1', 'sampleId': 'A-1', 'isNoise': False},
    {'globalNo': 2, 'procSpan': 0, 'workerSpan': 0, 'sampleSpan': 0, 'proc': '공정', 'workerName': 'W', 'location': 'L', 'hazard': 'H2', 'sampleId': 'A-1', 'isNoise': False},
    {'globalNo': 3, 'procSpan': 0, 'workerSpan': 0, 'sampleSpan': 0, 'proc': '공정', 'workerName': 'W', 'location': 'L', 'hazard': 'H3', 'sampleId': 'A-1', 'isNoise': False},
]

for rowIdx, row in enumerate(test_rows):
    tds = []
    for colId in order:
        def_obj = COLUMNS_DEF[colId]
        if def_obj['isGroupSpan'] == 'proc':
            if row['procSpan'] == 0: continue
            tds.append(f"<td>proc:{row['proc']} (span={row['procSpan']})</td>")
            continue
        if def_obj['isGroupSpan'] == 'worker':
            if row['workerSpan'] == 0: continue
            tds.append(f"<td>worker:{colId} (span={row['workerSpan']})</td>")
            continue
        if def_obj['isGroupSpan'] == 'sample':
            if row['sampleSpan'] == 0: continue
            spanAttr = f" (span={row['sampleSpan']})" if row['sampleSpan'] > 1 else ""
            if colId == 'sampleId':
                tds.append(f"<td>sid:{row['sampleId']}{spanAttr}</td>")
            else:
                tds.append(f"<td>{colId}{spanAttr}</td>")
            continue
        if colId == 'no':
            tds.append(f"<td>no:{row['globalNo']}</td>")
            continue
        if colId == 'hazard':
            tds.append(f"<td>hazard:{row['hazard']}</td>")
            continue
        if def_obj.get('isBlankHandwriting'):
            tds.append(f"<td>empty:{colId}</td>")
            continue
        if colId == 'remark':
            tds.append("<td>remark</td>")
            continue
        tds.append("<td>other</td>")
    print(f"Row {rowIdx}: {len(tds)} tds -> {[t.split(':')[0] for t in tds]}")
