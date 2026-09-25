from pathlib import Path
import json
import numpy as np
from analyze_holes import read_mesh
root=Path(__file__).resolve().parent
out=root/'repairs/table-v01';out.mkdir(parents=True,exist_ok=True)
v,f=read_mesh(root/'repairs/planar-v01/scene_patched.ply')
p=v[f];cross=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]);area=np.linalg.norm(cross,axis=1)*.5
center=p.mean(1);normal=cross/np.maximum(2*area[:,None],1e-12)
horizontal=(np.abs(normal[:,1])>.9)&(center[:,1]>.4)&(center[:,1]<1.1)
hist,bins=np.histogram(center[horizontal,1],bins=np.arange(.4,1.101,.005),weights=area[horizontal])
print('Horizontal surface height peaks (scene units):')
for i in np.argsort(hist)[-12:][::-1]:print(round(float(bins[i]),3),round(float(hist[i]),4))
height=float(bins[np.argmax(hist)]+.0025)
selection=horizontal&(np.abs(center[:,1]-height)<.035)
print('Selected surface height',height,'area',area[selection].sum(),'xz quantiles',np.quantile(center[selection][:,[0,2]],[0,.05,.5,.95,1],axis=0))
np.savez_compressed(out/'horizontal-surface.npz',centers=center[selection],areas=area[selection],height=height)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(9,8));s=ax.scatter(center[selection,0],center[selection,2],c=center[selection,1],s=3,cmap='viridis',vmin=height-.035,vmax=height+.035)
ax.set_aspect('equal');ax.set_xlabel('X (scene units)');ax.set_ylabel('Z (scene units)');ax.set_title('Observed horizontal triangles near tabletop height');ax.grid(alpha=.3);fig.colorbar(s,label='Y height');fig.savefig(out/'top-down-surfaces.png',dpi=160)
