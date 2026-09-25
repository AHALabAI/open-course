from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,ImageOps
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/room-v01'
views=json.loads((root/'runs/office-v01/cameras.json').read_text())
intr={int(s[0]):dict(zip(['width','height','fx','fy','cx','cy'],map(float,s[2:]))) for l in (root/'runs/office-v01/dense/sparse/cameras.txt').read_text().splitlines() if l and not l.startswith('#') for s in [l.split()]}
def uv(p,v):
 k=v['intrinsics'];q=(np.asarray(p)-v['position'])@v['rotation_camera_to_world'];return q[:,:2]/q[:,2,None]*[k['fx'],k['fy']]+[k['cx'],k['cy']],q[:,2]
for v in views:v['intrinsics']=intr[int(v['image'].split('_')[0])]
d,b=read_glb(root/'repairs/door-v01/office-door-repaired.glb');pts=np.unique(np.concatenate([accessor(d,b,p['attributes']['POSITION']) for p in d['meshes'][0]['primitives']]),axis=0)
for name,mask in [('screen_frame',(pts[:,0]<-2)&(pts[:,1]>1.34)&(pts[:,1]<2)&(abs(pts[:,2])<1.4)),('chart',(pts[:,0]>.20)&(pts[:,0]<.46)&(abs(pts[:,2])<.2)&(pts[:,1]>.78)&(pts[:,1]<1.2)),('can',(abs(pts[:,0]+.524)<.07)&(abs(pts[:,2]+.026)<.07)&(pts[:,1]>.77)&(pts[:,1]<1.2))]:
 p=pts[mask];print(name, np.quantile(p,[0,.05,.5,.95,1],axis=0).tolist())
regions={
 'screen_left':[[-2.175,1.34,-1.365],[-2.175,1.995,-1.365],[-2.175,1.995,-.055],[-2.175,1.34,-.055]],
 'screen_right':[[-2.175,1.34,-.015],[-2.175,1.995,-.015],[-2.175,1.995,1.19],[-2.175,1.34,1.19]],
 'chart':[[.205,.761,-.172],[.37,.828,-.172],[.37,.828,.115],[.205,.761,.115]],
 'can':[[-.584,.76,-.026],[-.584,.97,-.026],[-.464,.97,-.026],[-.464,.76,-.026]]}
chosen={};sheet=Image.new('RGB',(4*400,600),'white');draw=ImageDraw.Draw(sheet)
for i,(name,points) in enumerate(regions.items()):
 results=[]
 for v in views:
  xy,depth=uv(points,v);k=v['intrinsics']
  if min(depth)<.1 or np.any(xy<[10,10]) or np.any(xy>[k['width']-10,k['height']-10]):continue
  if name.startswith('screen') and (v['position'][0]<-1.7 or abs(v['position'][2])>1.4 or v['position'][1]<1 or v['position'][1]>1.9):continue
  if name=='chart' and (v['position'][0]>.18 or v['position'][1]<1.1):continue
  if name=='can' and v['image']!='6_REN0298.jpg':continue
  area=abs(np.dot(xy[:,0],np.roll(xy[:,1],1))-np.dot(xy[:,1],np.roll(xy[:,0],1)))/2
  results.append((area,v,xy))
 _,v,xy=max(results,key=lambda t:t[0]);chosen[name]={'corners':points,'view':v};im=Image.open(root/'source/images'/v['image']);dr=ImageDraw.Draw(im);dr.line([tuple(t) for t in xy]+[tuple(xy[0])],fill='red',width=3);im=ImageOps.contain(im,(390,560));sheet.paste(im,(i*400,25));draw.text((i*400+5,4),name+' '+v['image'],fill='black');print(name,v['image'])
sheet.save(out/'repair-reference-projections.jpg',quality=94);(out/'object-plan.json').write_text(json.dumps(chosen,indent=2))
