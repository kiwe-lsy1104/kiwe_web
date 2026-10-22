import struct

filename = "삼화정밀_2026_하반기.xls"

with open(filename, "rb") as f:
    data = f.read()

print("File size:", len(data))
# Check OLE2 signature
if data[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':
    print("Valid OLE2 signature!")
    # Sector size: 2 ^ sector_shift
    sector_shift = struct.unpack("<H", data[30:32])[0]
    sector_size = 1 << sector_shift
    print("Sector size:", sector_size)
    print("Remainder:", len(data) % sector_size)
else:
    print("Not standard OLE2")
