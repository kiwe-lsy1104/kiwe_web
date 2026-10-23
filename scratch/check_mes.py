import urllib.request
import json
import asyncio
import websockets

async def check():
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
        # reload page first
        cmd_reload = {
            "id": 1,
            "method": "Page.reload",
            "params": {}
        }
        await ws.send(json.dumps(cmd_reload))
        await ws.recv()
        await asyncio.sleep(2.5)

        expr = """
        (() => {
            const table = document.querySelector('.mes-table');
            return JSON.stringify({
                pages: paginateRows(MES.parsedRows, MES.rowsPerPage),
                rowsHtml: Array.from(table.querySelectorAll('tbody tr')).map(tr => tr.outerHTML)
            }, null, 2);
        })()
        """
        cmd = {
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {
                "expression": expr
            }
        }
        await ws.send(json.dumps(cmd))
        res = await ws.recv()
        data = json.loads(res)
        val = data.get('result', {}).get('result', {}).get('value', '')
        with open(r"c:\Users\lee seung yong\OneDrive\바탕 화면\kiwe_web\scratch\dom_debug_after.json", "w", encoding="utf-8") as f:
            f.write(val)
        print("Wrote dom_debug_after.json successfully")

asyncio.run(check())
