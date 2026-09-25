"""Bake a calibrated, unobstructed public floor patch for inferred missing floor."""
from pathlib import Path
import json,cv2,numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parent;out=root/'repairs/room-v01';views=json.loads((root/'runs/office-v01/cameras.json').read_text())
intr={int(s[0]):list(map(float,s[2:])) for l in (root/'runs/office-v01/dense/sparse/cameras.txt').read_text().splitlines() if l and not l.startswith('#') for s in [l.split()]}
p=np.array([[1.6,.012,-.5],[1.98,.012,-.5],[1.98,.012,-.12],[1.6,.012,-.12]]);candidates=[]
for v in views:
 if v['position'][0]<1.4 or v['position'][1]<.7:continue
 w,h,fx,fy,cx,cy=intr[int(v['image'].split('_')[0])];q=(p-v['position'])@v['rotation_camera_to_world'];xy=q[:,:2]/q[:,2,None]*[fx,fy]+[cx,cy]
 if min(q[:,2])<.1 or np.any(xy<10) or np.any(xy>[w-10,h-10]):continue
 area=abs(cv2.contourArea(xy.astype(np.float32)));candidates.append((area,v,xy))
_,v,xy=max(candidates,key=lambda c:c[0]);im=Image.open(root/'source/images'/v['image']);H=cv2.getPerspectiveTransform(xy.astype(np.float32),np.array([[0,0],[255,0],[255,255],[0,255]],np.float32));tile=cv2.warpPerspective(np.array(im),H,(256,256));Image.fromarray(tile).save(out/'floor-sample.png');draw=ImageDraw.Draw(im);draw.polygon([tuple(x) for x in xy],outline='red',width=3);im.save(out/'floor-reference.jpg');(out/'floor-reference.json').write_text(json.dumps({'view':v,'world_corners':p.tolist(),'pixels':xy.tolist(),'use':'Repeated observed carpet sample on an inferred floor patch; hidden under-table texture is not recovered'},indent=2));print(v['image'])
