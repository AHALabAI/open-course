"""Download fixed runtime assets and verify hashes. SPDX-License-Identifier: MIT"""
from pathlib import Path
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[1]
def fetch(dest,url,digest):
    if dest.exists():
        if hashlib.sha256(dest.read_bytes()).hexdigest()!=digest: raise SystemExit('Existing file differs: '+str(dest))
        return
    dest.parent.mkdir(parents=True,exist_ok=True)
    with urllib.request.urlopen(url,timeout=180) as response: data=response.read()
    if hashlib.sha256(data).hexdigest()!=digest: raise SystemExit('Hash mismatch: '+url)
    dest.write_bytes(data)
    print(dest.relative_to(ROOT))
for row in json.loads((ROOT/'vendor/manifest.json').read_text(encoding='utf-8')):fetch(ROOT/'vendor'/row['file'],row['url'],row['sha256'])
base='https://aha-lab.ai/course/finger-shadow/experience/'
for play in json.loads((ROOT/'assets/english/manifest.json').read_text(encoding='utf-8'))['plays']:
    for row in [play,*play['lines']]:fetch(ROOT/'assets/english'/row['file'],base+'assets/english/'+row['file'],row['sha256'])
for row in json.loads((ROOT/'assets/music/manifest.json').read_text(encoding='utf-8')):fetch(ROOT/row['file'],base+row['file'],row['sha256'])
