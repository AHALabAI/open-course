"""Camera-calibrated wall/ceiling texture baking, with mesh-depth occlusion masks.
No generated photographic content. Unobserved texels are explicitly recorded.
"""
from pathlib import Path
import json, numpy as np, cv2
from PIL import Image
from scipy.ndimage import distance_transform_edt
root=Path(__file__).resolve().parent;out=root/'repairs/envelope-v01'
views=json.loads((out/'views.json').read_text())
x0,x1,z0,z1,y0,y1=-2.385,2.485,-2.115,2.025,.08,2.435
surfaces=[
 ('wall_screen',[x0,y1,z1],[0,0,z0-z1],[0,y0-y1,0],[1,0,0]),
 ('wall_back',[x1,y1,z0],[0,0,z1-z0],[0,y0-y1,0],[-1,0,0]),
 ('wall_writing',[x0,y1,z0],[x1-x0,0,0],[0,y0-y1,0],[0,0,1]),
 ('wall_door',[x1,y1,z1],[x0-x1,0,0],[0,y0-y1,0],[0,0,-1]),
 ('ceiling',[x0,y1,z0],[x1-x0,0,0],[0,0,z1-z0],[0,-1,0])]
records=[]
for name,origin,uvec,vvec,normal in surfaces:
 origin=np.array(origin,np.float32);uvec=np.array(uvec,np.float32);vvec=np.array(vvec,np.float32);normal=np.array(normal,np.float32)
 width=int(np.ceil(np.linalg.norm(uvec)*280));height=int(np.ceil(np.linalg.norm(vvec)*280))
 yy,xx=np.mgrid[:height,:width];points=origin+(xx[...,None]/(width-1))*uvec+(yy[...,None]/(height-1))*vvec;points=points.astype(np.float32).reshape(-1,3)
 def project(v,p):
  k=v['intrinsics'];R=np.array(v['rotation_camera_to_world'],np.float32);q=(p-np.array(v['position'],np.float32))@R;z=q[:,2];den=np.maximum(z,.001);px=q[:,0]/den*k['fx']+k['cx'];py=q[:,1]/den*k['fy']+k['cy']
  vec=np.array(v['position'],np.float32)-p;distance=np.linalg.norm(vec,axis=1);cos=(vec@normal)/np.maximum(distance,.001)
  edge=np.minimum.reduce([px,py,k['width']-1-px,k['height']-1-py]);score=np.maximum(cos,0)**3*k['fx']/den*np.clip(edge/40,0,1)
  valid=(z>.1)&(edge>2)&(cos>.15)&(distance>.25)
  return px,py,z,score,valid
 # Keep a broad set of views, ranked by coverage and resolution of a coarse grid.
 coarse=points[::max(1,len(points)//1800)]
 ranked=[]
 for v in views:
  px,py,z,score,valid=project(v,coarse)
  if valid.sum()>30:ranked.append((float(np.sum(score[valid])),v))
 anchor_name={'wall_screen':'6_REN0730.jpg','wall_back':'6_REN0298.jpg','wall_writing':'6_REN0163.jpg','wall_door':'6_REN0460.jpg'}.get(name)
 chosen=[v for _,v in sorted(ranked,key=lambda q:q[0],reverse=True)[:48]]
 if anchor_name:
  anchor=next(v for v in views if v['image']==anchor_name)
  chosen=[anchor]+[v for v in chosen if v['image']!=anchor_name]
 best=np.zeros(len(points),np.float32);rgb=np.zeros((len(points),3),np.uint8);labels=np.full(len(points),-1,np.int16)
 candidates=[]
 for idx,v in enumerate(chosen):
  px,py,z,score,valid=project(v,points);k=v['intrinsics']
  depth=cv2.imread(str(out/'depth'/(v['image']+'.png')),cv2.IMREAD_COLOR)[:,:,::-1].astype(np.float32)
  depth=(depth[:,:,0]*256+depth[:,:,1])/65535*10
  observed=cv2.remap(depth,(px*depth.shape[1]/k['width']).reshape(height,width),(py*depth.shape[0]/k['height']).reshape(height,width),cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT).reshape(-1)
  valid&=(observed>.01)&(z<=observed+.10)
  score[~valid]=0
  im=cv2.cvtColor(cv2.imread(str(root/'source/images'/v['image'])),cv2.COLOR_BGR2RGB)
  warp=cv2.remap(im,px.reshape(height,width),py.reshape(height,width),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT).reshape(-1,3)
  if anchor_name:
   # A coherent wide view controls visible appearance; other views only fill its gaps.
   if idx==0:
    anchor_rgb=warp.copy();anchor_valid=valid.copy();score*=100000
   else:
    common=valid&anchor_valid&(anchor_rgb.mean(1)>65)&(warp.mean(1)>65)&(anchor_rgb.max(1)<225)&(warp.max(1)<225)
    if common.sum()>500:
     delta=np.median(anchor_rgb[common].astype(np.float32)-warp[common].astype(np.float32),axis=0)
     warp=np.clip(warp.astype(np.float32)+np.clip(delta,-35,35),0,255).astype(np.uint8)
   # Proxy furniture differs from real furniture: reject large dark foreground projections
   # on the whiteboard walls; retain the anchor's thin handwriting and wall fixtures.
   if name in ['wall_back','wall_writing']:
    valid &= cv2.GaussianBlur(warp.reshape(height,width,3).mean(2).astype(np.float32),(0,0),7).reshape(-1)>70
    score[~valid]=0
  take=score>best;rgb[take]=warp[take];best[take]=score[take];labels[take]=idx
  candidates.append((v,score.reshape(height,width),warp.reshape(height,width,3)))
 # Feather source selection within valid observations; do not blur image details.
 accum=np.zeros((height,width,3),np.float32);weight=np.zeros((height,width),np.float32)
 labels=labels.reshape(height,width)
 for idx,(v,score,warp) in enumerate(candidates):
  mask=cv2.GaussianBlur((labels==idx).astype(np.float32),(0,0),4)
  mask*=score>0
  accum+=warp*mask[:,:,None];weight+=mask
 covered=weight>1e-8;result=rgb.reshape(height,width,3).copy();result[covered]=np.clip(accum[covered]/weight[covered,None],0,255).astype(np.uint8)
 missing=best.reshape(height,width)==0
 if missing.any():
  inds=distance_transform_edt(missing,return_distances=False,return_indices=True);result[missing]=result[inds[0][missing],inds[1][missing]]
 Image.fromarray(result).save(out/(name+'.png'))
 Image.fromarray((missing*255).astype(np.uint8)).save(out/(name+'-unobserved.png'))
 record={'name':name,'origin':origin.tolist(),'u':uvec.tolist(),'v':vvec.tolist(),'normal':normal.tolist(),'width':width,'height':height,'unobserved_fraction':float(missing.mean()),'unobserved_fill':'Nearest observed texel; inferred appearance, not recovered detail','sources':[v['image'] for v in chosen]}
 records.append(record);print(name,width,height,'unobserved',round(missing.mean()*100,2),'%',flush=True)
(out/'surface-plan.json').write_text(json.dumps({'source':'public calibrated office1a originals','method':'5 inferred planes; depth-tested calibrated reprojection; source-mask feathering; explicitly masked nearest-sample fill','surfaces':records},indent=2))
