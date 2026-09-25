from pathlib import Path
import json
import numpy as np
from scipy import ndimage
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/room-v01';out.mkdir(parents=True,exist_ok=True)
doc,binary=read_glb(root/'repairs/door-v01/office-door-repaired.glb')
v=np.concatenate([accessor(doc,binary,p['attributes']['POSITION']) for p in doc['meshes'][0]['primitives']]);v=np.unique(v,axis=0)
mask=(v[:,1]>.85)&(v[:,1]<1.15)&(v[:,0]>-1.9)&(v[:,0]<1.6)&(np.abs(v[:,2])<1.4)&((v[:,0]<-1.24)|(v[:,0]>1.0)|(np.abs(v[:,2])>.68))
points=v[mask]
hist,xe,ze=np.histogram2d(points[:,0],points[:,2],bins=[np.arange(-1.9,1.61,.04),np.arange(-1.4,1.41,.04)])
occupancy=ndimage.binary_closing(hist>1,iterations=1);labels,count=ndimage.label(occupancy)
groups=[]
for i in range(1,count+1):
 indices=np.argwhere(labels==i)
 if len(indices)<5:continue
 weights=hist[labels==i];cx=(xe[indices[:,0]]+.02);cz=(ze[indices[:,1]]+.02)
 groups.append({'center':[float(np.average(cx,weights=weights)),float(np.average(cz,weights=weights))],'cells':len(indices),'xz_bounds':[float(cx.min()-.02),float(cx.max()+.02),float(cz.min()-.02),float(cz.max()+.02)]})
print(json.dumps(groups,indent=2));(out/'chair-clusters.json').write_text(json.dumps(groups,indent=2))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(9,8));ax.scatter(points[:,0],points[:,2],s=.3,c=points[:,1],cmap='viridis')
for i,g in enumerate(groups):ax.annotate(str(i),g['center'],fontsize=18,color='red')
ax.add_patch(plt.Rectangle((-1.181,-.629),2.110,1.209,fill=False,color='orange',lw=2));ax.set_aspect('equal');ax.set_xlabel('X');ax.set_ylabel('Z');ax.set_title('Chair-back observations outside tabletop');ax.grid(alpha=.2);fig.savefig(out/'chair-audit.png',dpi=160)
from PIL import Image,ImageOps,ImageDraw
sources=sorted((root/'source/images').glob('6_*.jpg'));sheet=Image.new('RGB',(7*200,5*230),'#e7e7df')
for i,p in enumerate(sources):
 with Image.open(p) as img:thumb=ImageOps.contain(img,(194,202))
 x=i%7*200;y=i//7*230;sheet.paste(thumb,(x,y));ImageDraw.Draw(sheet).text((x+3,y+206),p.name,fill='black')
sheet.save(out/'source-audit.jpg',quality=92)
