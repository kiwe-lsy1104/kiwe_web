import sys

filename = "삼화정밀_2026_하반기.xls"

with open(filename, "rb") as f:
    header_bytes = f.read(512)

print("First 64 bytes (hex):", header_bytes[:64].hex())
print("First 128 bytes (ascii/utf-8 attempt):", repr(header_bytes[:128]))

# Check if xlrd or other tools are installed, or if it's html/xml
try:
    import xlrd
    print("xlrd is installed!")
    wb = xlrd.open_workbook(filename)
    sheet = wb.sheet_by_index(0)
    print(f"Sheet name: {sheet.name}, nrows={sheet.nrows}, ncols={sheet.ncols}")
    for r in range(min(sheet.nrows, 15)):
        row_vals = [str(sheet.cell_value(r, c)) for c in range(min(sheet.ncols, 40))]
        print(f"Row {r}: {row_vals}")
except Exception as e:
    print("xlrd error or not installed:", e)
