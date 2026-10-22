import xlrd

wb = xlrd.open_workbook("scratch/samhwa_fixed.xls", encoding_override="cp949")
ws = wb.sheet_by_index(0)

print(f"Total rows: {ws.nrows}, Total cols: {ws.ncols}")

# Print headers (row 0 to 4)
for r in range(min(ws.nrows, 6)):
    row_vals = []
    for c in range(ws.ncols):
        v = ws.cell_value(r, c)
        if str(v).strip():
            colLetter = xlrd.colname(c)
            row_vals.append(f"{colLetter}({c}):{v}")
    print(f"--- Row {r+1} ---")
    print(" | ".join(row_vals))

print("\n=== SAMPLE DATA (Row 2 to 25) ===")
for r in range(1, min(ws.nrows, 30)):
    # print relevant columns
    cols_to_show = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]
    items = []
    for c in range(min(ws.ncols, 40)):
        v = ws.cell_value(r, c)
        if str(v).strip():
            colL = xlrd.colname(c)
            items.append(f"{colL}:{v}")
    print(f"Row {r+1}: " + " | ".join(items))
