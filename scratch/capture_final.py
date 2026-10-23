import urllib.request
import json
import asyncio
import websockets
import base64

async def take_shot():
    req = urllib.request.urlopen("http://localhost:9222/json")
    pages = json.loads(req.read())
    ws_url = None
    for p in pages:
        if '8085' in p.get('url', ''):
            ws_url = p.get('webSocketDebuggerUrl')
            break
    if not ws_url:
        print("Page not found on 8085")
        return

    async with websockets.connect(ws_url) as ws:
        cmd = {
            "id": 1,
            "method": "Page.captureScreenshot",
            "params": {
                "format": "png"
            }
        }
        await ws.send(json.dumps(cmd))
        res = await ws.recv()
        data = json.loads(res)
        b64 = data.get('result', {}).get('data', '')
        with open(r"c:\Users\lee seung yong\OneDrive\바탕 화면\kiwe_web\scratch\yongin_fixed.png", "wb") as f:
            f.write(base64.b64decode(b64))
        print("Saved yongin_fixed.png")

asyncio.run(take_shot())
