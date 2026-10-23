import json
import urllib.request
import asyncio
import websockets

async def get_dom():
    req = urllib.request.urlopen("http://localhost:9222/json")
    pages = json.loads(req.read())
    ws_url = None
    for p in pages:
        if 'mes_converter' in p.get('url', ''):
            ws_url = p.get('webSocketDebuggerUrl')
            break
    if not ws_url:
        print("No mes_converter page found via CDP")
        return

    async with websockets.connect(ws_url) as ws:
        # evaluate js
        cmd = {
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "document.querySelector('.mes-table')?.outerHTML || 'NO TABLE'"
            }
        }
        await ws.send(json.dumps(cmd))
        res = await ws.recv()
        data = json.loads(res)
        html = data.get('result', {}).get('result', {}).get('value', '')
        with open(r"c:\Users\lee seung yong\OneDrive\바탕 화면\kiwe_web\scratch\table_dump.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Dumped HTML: {len(html)} bytes")

asyncio.run(get_dom())
