from pathlib import Path
import json
import numpy as np
from scipy import ndimage
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/room-v01'
d,b=read_glb(root/'repairs/door-v01/office-door-repaired.glb')
v=np.unique(np.concatenate([accessor(d,b,p['attributes']['POSITION']) for p in d['meshes'][0]['primitives']]),axis=0)
fig,axes=plt.subplots(1,3,figsize=(19,7))
for ax,mask,a,c,title in [(axes[0],(v[:,1]>.79)&(v[:,1]<1.1)&(abs(v[:,2])<.6)&(v[:,0]>-1.2)&(v[:,0]<.93),0,2,'Table objects Y>.79'),(axes[1],(v[:,0]<-1.8)&(v[:,1]>.4),2,1,'Screen wall X<-1.8'),(axes[2],(v[:,1]<.7)&(v[:,1]>.03)&(abs(v[:,2])<1)&(abs(v[:,0])<1.4),0,2,'Under table')]:
 p=v[mask];ax.scatter(p[:,a],p[:,c],c=p[:,1],s=.8);ax.set_title(title);ax.set_aspect('equal');ax.grid();ax.set_xlabel('XYZ'[a]);ax.set_ylabel('XYZ'[c])
fig.tight_layout();fig.savefig(out/'details-audit.png',dpi=150)
print('bounds',v.min(0),v.max(0))
