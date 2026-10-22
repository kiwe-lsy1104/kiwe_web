import struct, xlrd

with open("삼화정밀_2026_하반기.xls", "rb") as f:
    data = f.read()

pad = 512 - (len(data) % 512)
padded_data = data + b'\x00' * pad

with open("scratch/samhwa_padded.xls", "wb") as f:
    f.write(padded_data)

try:
    wb = xlrd.open_workbook("scratch/samhwa_padded.xls")
    print("SUCCESS with padding!")
except Exception as e:
    print("Failed with padding:", e)
