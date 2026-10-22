import olefile, struct

ole = olefile.OleFileIO("삼화정밀_2026_하반기.xls")
print("Streams:", ole.listdir())

stream_name = None
for s in ole.listdir():
    if s[0].lower() in ['workbook', 'book']:
        stream_name = s[0]
        break

if stream_name:
    stream = ole.openstream(stream_name)
    biff_data = stream.read()
    print("BIFF stream length:", len(biff_data))
    
    # Parse records
    idx = 0
    records = []
    while idx < len(biff_data) - 4:
        opcode, length = struct.unpack("<HH", biff_data[idx:idx+4])
        records.append((idx, opcode, length))
        if opcode == 0x0017: # EXTERNSHEET
            print(f"Found EXTERNSHEET at {idx}: len={length}")
            rec_body = biff_data[idx+4:idx+4+length]
            print("EXTERNSHEET hex:", rec_body[:64].hex())
            # next record
            next_op, next_len = struct.unpack("<HH", biff_data[idx+4+length:idx+4+length+4])
            print(f"Next record at {idx+4+length}: op=0x{next_op:04x}, len={next_len}")
        idx += 4 + length
    print(f"Total records: {len(records)}")
