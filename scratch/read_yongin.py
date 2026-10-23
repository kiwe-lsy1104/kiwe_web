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

with open(r"c:\Users\lee seung yong\OneDrive\바탕 화면\kiwe_web\scratch\yongin_headers.txt", 'w', encoding='utf-8') as out:
    for c in range(sheet.ncols):
        out.write(f"Col {c:2d}: {repr(sheet.cell_value(0, c))}\n")
    out.write("\nRow 1:\n")
    for c in range(sheet.ncols):
        v = sheet.cell_value(1, c)
        if v:
            out.write(f"Col {c:2d} ({repr(sheet.cell_value(0, c))}): {repr(v)}\n")
