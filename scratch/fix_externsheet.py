import olefile, struct, xlrd

# Let's fix the EXTERNSHEET record in the BIFF stream and re-save
with open("삼화정밀_2026_하반기.xls", "rb") as f:
    ole_bytes = bytearray(f.read())

# Find the EXTERNSHEET opcode 0x0017 and len=8 in the file
# 17 00 08 00 ae 01
target = b'\x17\x00\x08\x00\xae\x01'
pos = ole_bytes.find(target)
print("Found target at:", pos)
if pos != -1:
    # replace \xae\x01 with \x01\x00
    ole_bytes[pos+4:pos+6] = b'\x01\x00'
    fixed_path = "scratch/samhwa_fixed.xls"
    with open(fixed_path, "wb") as f:
        f.write(ole_bytes)
    print("Fixed file written!")
    
    # Test with xlrd
    try:
        wb = xlrd.open_workbook(fixed_path)
        print("XLRD SUCCESS! Sheet:", wb.sheet_names())
        s = wb.sheet_by_index(0)
        print("Rows:", s.nrows, "Cols:", s.ncols)
        for r in range(min(s.nrows, 20)):
            row_v = [s.cell_value(r, c) for c in range(min(s.ncols, 35)) if str(s.cell_value(r, c)).strip() != '']
            print(f"Row {r+1}: {row_v[:10]}")
    except Exception as e:
        print("xlrd error:", e)
