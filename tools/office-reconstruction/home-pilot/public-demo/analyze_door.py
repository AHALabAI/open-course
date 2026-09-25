from pathlib import Path
import json
import numpy as np
root=Path(__file__).resolve().parent;out=root/'repairs/door-v01';out.mkdir(parents=True,exist_ok=True)
views=json.loads((root/'runs/office-v01/cameras.json').read_text())
intrinsics={}
for line in (root/'runs/office-v01/dense/sparse/cameras.txt').read_text().splitlines():
 if line and not line.startswith('#'):
  a=line.split();intrinsics[int(a[0])]=dict(zip(['width','height','fx','fy','cx','cy'],map(float,a[2:])))
# Door frame bounds inferred from surviving geometry and the calibrated front reference view.
bounds={'xmin':.465,'xmax':2.36,'ymin':.0,'ymax':2.17,'front_z':2.005,'back_z':2.075}
corners=np.array([[bounds['xmin'],bounds['ymin'],bounds['front_z']],[bounds['xmax'],bounds['ymin'],bounds['front_z']],[bounds['xmax'],bounds['ymax'],bounds['front_z']],[bounds['xmin'],bounds['ymax'],bounds['front_z']]])
ranked=[]
for view in views:
 camera=np.array(view['position']);R=np.array(view['rotation_camera_to_world']);k=intrinsics[int(view['image'][0])]
 q=(corners-camera)@R
 if np.any(q[:,2]<.2) or camera[2]>bounds['front_z']-.6:continue
 uv=q[:,:2]/q[:,2,None]*[k['fx'],k['fy']]+[k['cx'],k['cy']]
 if np.any(uv<8) or np.any(uv[:,0]>k['width']-8) or np.any(uv[:,1]>k['height']-8):continue
 area=abs(np.sum(uv[:,0]*np.roll(uv[:,1],-1)-uv[:,1]*np.roll(uv[:,0],-1)))*.5
 ranked.append(dict(**view,intrinsics=k,projected_corners=uv.tolist(),pixel_area=float(area)))
ranked.sort(key=lambda x:x['pixel_area'],reverse=True)
assert ranked
chosen=next(v for v in ranked if v['image']=='3_REN0406.jpg')
data={'bounds':bounds,'texture_source':chosen,'selection_note':'Visually reviewed full door image with balanced camera height and no foreground occlusion.','candidates':[{k:v[k] for k in ['image','position','pixel_area']} for v in ranked[:8]],'provenance':'Door surfaces and frame dimensions inferred; original photo used as opaque baked appearance. No geometry is asserted for the space behind the glass.'}
(out/'door-plan.json').write_text(json.dumps(data,indent=2));print(json.dumps({'bounds':bounds,'candidates':data['candidates']},indent=2))
