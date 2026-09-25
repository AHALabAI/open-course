"""Explicit inferred matte finishes where foregrounds prevent reliable wall textures.
Keep photographic handwriting/fixtures; no source photographs are modified.
"""
from pathlib import Path
import json,cv2,numpy as np
from PIL import Image
root=Path(__file__).resolve().parent;out=root/'repairs/envelope-v01'
plan=json.loads((out/'surface-plan.json').read_text());records=[]
for s in plan['surfaces']:
 name=s['name'];im=np.asarray(Image.open(out/(name+'.png')).convert('RGB')).copy();h,w=im.shape[:2]
 if name in ['wall_back','wall_writing']:
  sample=im[int(h*.24):int(h*.36),int(w*.82):int(w*.91)];base=np.median(sample.reshape(-1,3),axis=0)
  mask=np.zeros((h,w),np.float32)
  boxes={'wall_back':[(.16,.06,.96,.65),(.375,.808,.410,.883)],'wall_writing':[(.13,.07,.86,.71),(.721,.782,.750,.865)]}[name]
  for x0,y0,x1,y1 in boxes:mask[int(h*y0):int(h*y1),int(w*x0):int(w*x1)]=1
  mask=cv2.GaussianBlur(mask,(0,0),10)
  clean=np.clip(im*mask[:,:,None]+base*(1-mask[:,:,None]),0,255).astype(np.uint8)
  s['material_inference']='Matte wall-color infill around retained photo handwriting and fixture patches; no recovered hidden wall detail'
 elif name=='wall_screen':
  tile=im[345:425,48:128].copy();tile=np.concatenate([tile,tile[:,::-1]],axis=1);tile=np.concatenate([tile,tile[::-1]],axis=0)
  clean=np.tile(tile,(int(np.ceil(h/len(tile))),int(np.ceil(w/tile.shape[1])),1))[:h,:w]
  s['material_inference']='Observed unobstructed fabric sample mirrored and repeated behind separately preserved screens; hidden background inferred'
 elif name=='wall_door':
  clean=im.copy();sample=im[int(h*.60):int(h*.65),int(w*.63):int(w*.70)];base=np.median(sample.reshape(-1,3),axis=0)
  mask=np.zeros((h,w),np.float32);mask[int(h*.675):,int(w*.408):int(w*.592)]=1;mask=cv2.GaussianBlur(mask,(0,0),8)
  clean=np.clip(im*(1-mask[:,:,None])+base*mask[:,:,None],0,255).astype(np.uint8)
  s['material_inference']='Local matte wall-color infill removes foreground chair imprint; existing door mesh preserved'
 else:continue
 s['texture_file']=name+'-finished.png';Image.fromarray(clean).save(out/s['texture_file']);records.append({'surface':name,'method':s['material_inference']})
# The corner pilaster has two observed orthogonal faces; dimensions inferred from scan peaks.
for name,o,u,v,n,col in [
 ('corner_pilaster_front',[2.215,2.435,-2.115],[0,0,.607],[0,-2.43,0],[-1,0,0],[125,128,123]),
 ('corner_pilaster_side',[2.215,2.435,-1.508],[.270,0,0],[0,-2.43,0],[0,0,1],[118,121,116])]:
 file=name+'.png';Image.fromarray(np.full((16,16,3),col,dtype=np.uint8)).save(out/file)
 plan['surfaces'].append({'name':name,'origin':o,'u':u,'v':v,'normal':n,'width':16,'height':16,'sources':[],'unobserved_fraction':1.0,'texture_file':file,'material_inference':'Inferred matte column finish; dimensions fitted approximately from scan, not measured'})
(out/'surface-plan-finished.json').write_text(json.dumps(plan,indent=2));(out/'material-inference-record.json').write_text(json.dumps(records,indent=2));print('Finished inferred matte areas and corner pilaster')
