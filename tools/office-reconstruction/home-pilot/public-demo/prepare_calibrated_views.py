"""Use official rectified images + supplied camera/point calibration, not a new SfM solution."""
from pathlib import Path
import json
import shutil
from PIL import Image,ImageOps,ImageDraw
import numpy as np

root=Path(__file__).resolve().parent
source=root/'source'
run=root/'runs/office-v01'
run.mkdir(parents=True,exist_ok=False)
for name in ['dense/images','dense/sparse','mvs','logs','review']:(run/name).mkdir(parents=True)
names={p.name for p in (source/'images').glob('*.jpg')}
if len(names)!=261:raise ValueError(f'Expected 261 downloaded views, found {len(names)}')
images={}
lines=iter((source/'model-txt/images.txt').read_text().splitlines())
for line in lines:
    if not line or line.startswith('#'):continue
    header=line.split()
    observations=next(lines).split()
    if header[9] in names:images[int(header[0])]=(header,observations)
points=[]
valid=set()
for line in (source/'model-txt/points3D.txt').read_text().splitlines():
    if not line or line.startswith('#'):continue
    f=line.split();track=f[8:]
    retained=[(int(track[i]),int(track[i+1])) for i in range(0,len(track),2) if int(track[i]) in images]
    if len(retained)>=2:
        valid.add(int(f[0]));points.append(f[:8]+[str(x) for pair in retained for x in pair])
ratios={}
cameras=[]
for line in (source/'model-txt/cameras.txt').read_text().splitlines():
    if not line or line.startswith('#'):continue
    f=line.split();cid=int(f[0]);assert f[1]=='PINHOLE'
    candidates=[h[9] for h,o in images.values() if int(h[8])==cid]
    sizes={Image.open(source/'images'/n).size for n in candidates}
    if len(sizes)!=1:raise ValueError('Mixed image size within calibrated sensor')
    width,height=next(iter(sizes));sx,sy=width/int(f[2]),height/int(f[3]);ratios[cid]=(sx,sy)
    fx,fy,cx,cy=map(float,f[4:8])
    cameras.append(f'{cid} PINHOLE {width} {height} {fx*sx:.12g} {fy*sy:.12g} {cx*sx:.12g} {cy*sy:.12g}')
image_lines=[]
camera_centers=[]
for iid,(header,observations) in images.items():
    sx,sy=ratios[int(header[8])]
    fixed=[]
    for j in range(0,len(observations),3):
        pid=int(observations[j+2]);fixed.extend([f'{float(observations[j])*sx:.10g}',f'{float(observations[j+1])*sy:.10g}',str(pid if pid in valid else -1)])
    image_lines.extend([' '.join(header),' '.join(fixed)])
    shutil.copy2(source/'images'/header[9],run/'dense/images'/header[9])
    w,x,y,z=map(float,header[1:5]);t=np.array(list(map(float,header[5:8])))
    R=np.array([[1-2*y*y-2*z*z,2*x*y-2*w*z,2*x*z+2*w*y],
                [2*x*y+2*w*z,1-2*x*x-2*z*z,2*y*z-2*w*x],
                [2*x*z-2*w*y,2*y*z+2*w*x,1-2*x*x-2*y*y]])
    camera_centers.append({'id':iid,'image':header[9],'position':(-R.T@t).tolist(),
                           'rotation_camera_to_world':R.T.tolist(),'source':'provided dataset calibration'})
(run/'dense/sparse/cameras.txt').write_text('\n'.join(cameras)+'\n')
(run/'dense/sparse/images.txt').write_text('\n'.join(image_lines)+'\n')
(run/'dense/sparse/points3D.txt').write_text('\n'.join(' '.join(p) for p in points)+'\n')
(run/'cameras.json').write_text(json.dumps(camera_centers,indent=2))
samples=sorted((source/'images').glob('*.jpg'))
# Representative first, middle, last selected position per direction, not private images.
samples=[samples[i] for i in range(0,len(samples),10)]
sheet=Image.new('RGB',(6*200,5*190),'#f2f2ed')
for i,p in enumerate(samples):
    with Image.open(p) as img:thumb=ImageOps.contain(img,(192,158))
    x=(i%6)*200;y=(i//6)*190
    sheet.paste(thumb,(x+(200-thumb.width)//2,y));ImageDraw.Draw(sheet).text((x+4,y+164),p.name,fill='black')
sheet.save(run/'review/source-contact.jpg',quality=90)
summary={'images':len(images),'camera_groups':len(cameras),'provided_sparse_points_retained':len(points),
         'source':'Eyeful Tower office1a official rectified images_8',
         'not_new_sfm':True,'scaling':'fx,cx,x scaled by actual width ratio; fy,cy,y by actual height ratio',
         'planned':'Recompute dense geometry and textures using supplied camera calibration.'}
(run/'preparation.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
