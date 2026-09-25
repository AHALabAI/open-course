"""Acquire publicly licensed, calibrated views only; no user images are read."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import hashlib
import json
import requests

ROOT=Path(__file__).resolve().parent
BASE='https://fb-baas-f32eacb9-8abb-11eb-b2b8-4857dd089e15.s3.amazonaws.com/EyefulTower/office1a/'

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':self.links.extend(v for k,v in attrs if k=='href')

def get(remote,local):
    local=ROOT/local
    local.parent.mkdir(parents=True,exist_ok=True)
    if not local.exists():
        r=requests.get(BASE+remote,timeout=90)
        r.raise_for_status()
        with local.open('xb') as f:f.write(r.content)
    data=local.read_bytes()
    return {'url':BASE+remote,'file':str(local.relative_to(ROOT)),
            'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

if __name__=='__main__':
    p=Links();p.feed(requests.get(BASE+'colmap/sparse/0/index.html',timeout=30).text)
    print('Model files',p.links[-20:],flush=True)
    records=[]
    for name in ['cameras.bin','images.bin','points3D.bin']:
        records.append(get('colmap/sparse/0/'+name,'source/model/'+name))
    tasks=[]
    # Nine calibrated rig directions at every third capture position: 29 positions, 261 views.
    for frame in range(0,85,3):
        number=frame*9+1
        for camera in range(9):
            name=f'{camera}_REN{number:04d}.jpg'
            tasks.append(('colmap/images_8/'+name,'source/images/'+name))
    with ThreadPoolExecutor(max_workers=8) as executor:
        for i,result in enumerate(executor.map(lambda pair:get(*pair),tasks),1):
            records.append(result)
            if i%30==0:print('Downloaded',i,'/',len(tasks),flush=True)
    manifest={'source':'Meta Eyeful Tower office1a', 'license':'MIT (all content relicensed 2026-03-11)',
              'input':'Official undistorted images_8 and provided calibrated COLMAP poses',
              'selection':'Every third of 85 rig positions, all 9 directions',
              'images':len(tasks),'files':records}
    (ROOT/'source-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Acquisition complete',len(tasks),'views',flush=True)
