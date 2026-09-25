from pathlib import Path
import json,numpy as np
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/envelope-v01';out.mkdir(parents=True,exist_ok=True)
d,b=read_glb(root/'repairs/room-v01/office-room-final.glb')
views=json.loads((root/'runs/office-v01/cameras.json').read_text())
intr={int(s[0]):dict(zip(['width','height','fx','fy','cx','cy'],map(float,s[2:]))) for l in (root/'runs/office-v01/dense/sparse/cameras.txt').read_text().splitlines() if l and not l.startswith('#') for s in [l.split()]}
for v in views:v['intrinsics']=intr[int(v['image'].split('_')[0])]
(out/'views.json').write_text(json.dumps(views,indent=2))
rows=[]
for mi,m in enumerate(d['meshes']):
 for pi,p in enumerate(m['primitives']):
  v=accessor(d,b,p['attributes']['POSITION']);f=accessor(d,b,p['indices']).reshape(-1,3)
  if mi==0:
   tri=v[f];cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area=np.linalg.norm(cross,axis=1)/2;n=cross/np.maximum(2*area[:,None],1e-12);c=tri.mean(1)
   print('scan bounds',v.min(0),v.max(0))
   for axis in range(3):
    mask=(np.abs(n[:,axis])>.8)&(area>1e-8)
    hist,edges=np.histogram(c[mask,axis],bins=np.arange(-4,4,.025),weights=area[mask])
    print('axis',axis,sorted(zip(hist,(edges[:-1]+edges[1:])/2),reverse=True)[:12])
   np.savez_compressed(out/f'scan-surface-samples-{pi}.npz',centers=c,area=area,normals=n)
  rows.append({'mesh':mi,'name':m.get('name'),'nodes':[x.get('name') for x in d['nodes'] if x.get('mesh')==mi],'faces':len(f),'min':v.min(0).tolist(),'max':v.max(0).tolist()})
(out/'baseline-mesh-inventory.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows[:4],indent=2))
