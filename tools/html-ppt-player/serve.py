"""Serve this package's web directory on the local computer."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import argparse

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8826)
    args=parser.parse_args()
    root=Path(__file__).resolve().parent/'web'
    class Handler(SimpleHTTPRequestHandler):
        extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}
    with ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(root))) as server:
        print(f'http://127.0.0.1:{args.port}/',flush=True)
        try: server.serve_forever()
        except KeyboardInterrupt: pass
if __name__=='__main__': main()
