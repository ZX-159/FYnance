#!/usr/bin/env python3
"""Mock chkbal.php for testing find_payload.py.
Returns the populated page ONLY for known card IDs, blank template otherwise.
Usage: MOCK_VALID_IDS=240159,0002329052 python3 mock_server.py
"""
import base64
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

VALID = set(os.environ.get("MOCK_VALID_IDS", "").split(","))
TEMPLATE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "mock", "saved_chkbal.php"), encoding="utf-8").read()

def populated(name="陈小明 CHEN XIAO MING", no="2023J1A123", cls="J1A 初一甲",
              bal="25.80"):
    html = TEMPLATE
    html = re.sub(r"<input type='text' readonly class='form-control form-control-sm' value=''>",
                  f"<input type='text' readonly class='form-control form-control-sm' value='{name}'>",
                  html, count=1)
    html = re.sub(r"<input type='text' readonly class='form-control form-control-sm' value=''>",
                  f"<input type='text' readonly class='form-control form-control-sm' value='{no}'>",
                  html, count=1)
    html = re.sub(r"<input type='text' readonly class='form-control form-control-sm' value=''>",
                  f"<input type='text' readonly class='form-control form-control-sm' value='{cls}'>",
                  html, count=1)
    html = html.replace('<label class="col-lg-12 center" style="font-size: 32pt;">',
                        f'<label class="col-lg-12 center" style="font-size: 32pt;">{bal}</label>')
    tx = ("<tr><td>2026-08-01 08:12</td><td>食堂 Canteen</td><td>炒面</td>"
          "<td>1</td><td>4.50</td><td>4.50</td></tr>")
    html, n = re.subn(r"(<tbody[^>]*>)\s*(</tbody>)",
                      lambda m: m.group(1) + "\n" + tx + "\n" + m.group(2),
                      html, count=1)
    return html

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        ln = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(ln).decode("utf-8", errors="replace")
        import urllib.parse
        fields = urllib.parse.parse_qs(body)
        idcard = fields.get("idcard", [""])[0]
        try:
            cid = base64.b64decode(idcard).decode("utf-8", errors="replace")
        except Exception:
            cid = "?"
        print(f"[MOCK] POST {self.path}  idcard decoded: {cid!r}")
        page = populated() if cid in VALID else TEMPLATE
        enc = page.encode("gb18030", errors="replace")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=gbk")
        self.send_header("Content-Length", str(len(enc)))
        self.end_headers()
        self.wfile.write(enc)

    def log_message(self, *a):
        pass

print("mock server on :8899")
HTTPServer(("127.0.0.1", int(os.environ.get("MOCK_PORT", "8899"))), Handler).serve_forever()
