"""Serve this game locally. Copyright 2026 AHALab contributors. MIT."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from functools import partial
import argparse
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript','.ogg':'audio/ogg','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'}
    def list_directory(self,path):self.send_error(404);return None
    def end_headers(self):self.send_header('Cache-Control','no-cache');super().end_headers()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8766);p.add_argument('--host',default='127.0.0.1');a=p.parse_args()
    server=ThreadingHTTPServer((a.host,a.port),partial(Handler,directory=str(ROOT)))
    print(f'Open http://127.0.0.1:{a.port}/',flush=True)
    print('For LAN sharing use --host 0.0.0.0 and the host computer address.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
