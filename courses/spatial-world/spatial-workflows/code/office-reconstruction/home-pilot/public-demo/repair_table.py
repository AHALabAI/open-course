"""Constrained tabletop replacement within a documented ROI; preserve objects and old version."""
from pathlib import Path
import json
import numpy as np
from analyze_holes import read_mesh
root=Path(__file__).resolve().parent;out=root/'repairs/table-v01';out.mkdir(parents=True,exist_ok=True)
target=out/'scene_table_repaired.ply'
if target.exists():raise FileExistsError(target)
v,f=read_mesh(root/'repairs/planar-v01/scene_patched.ply')
p=v[f];center=p.mean(1);cross=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]);area=np.linalg.norm(cross,axis=1)*.5
normal=cross/np.maximum(2*area[:,None],1e-12)
horizontal=(np.abs(normal[:,1])>.95)&(center[:,1]>.745)&(center[:,1]<.775)
roi=(center[:,0]>-1.28)&(center[:,0]<1.0)&(np.abs(center[:,2])<.72)
c=center[horizontal&roi]
# Robust medians of visibly surviving outer rim segments, not a room-wide bounding box.
xmin=float(np.median(c[c[:,0]<-1.12,0]));xmax=float(np.median(c[c[:,0]>.88,0]))
zmin=float(np.median(c[c[:,2]<-.57,2]));zmax=float(np.median(c[c[:,2]>.52,2]))
rim=(c[:,0]<xmin+.04)|(c[:,0]>xmax-.04)|(c[:,2]<zmin+.04)|(c[:,2]>zmax-.04)
height=float(np.median(c[rim,1]));thickness=.025 # Design assumption for a visible table edge, not measured.
assert 2.0<xmax-xmin<2.3 and 1.1<zmax-zmin<1.4 and .74<height<.78
# Object ROIs derived from visible pen holder and color chart in the source views.
# Preserve their observed geometry, including attachment to the reconstructed tabletop.
objects=[{'name':'pen-holder','xz':[-.75,-.27,-.25,.25]}, {'name':'color-chart','xz':[-.25,.60,-.30,.28]}]
protected=np.zeros(len(f),dtype=bool)
for obj in objects:
 a,b,c0,d=obj['xz'];protected|=(center[:,0]>a)&(center[:,0]<b)&(center[:,2]>c0)&(center[:,2]<d)
inside=(center[:,0]>xmin-.008)&(center[:,0]<xmax+.008)&(center[:,2]>zmin-.008)&(center[:,2]<zmax+.008)
remove=inside&(center[:,1]>height-.095)&(center[:,1]<height+.028)&(~protected)
kept=f[~remove]
new_v=[];new_f=[]
def surface(a,b,c,d,nu,nv):
 start=len(new_v)
 a,b,c,d=map(lambda q:np.array(q,dtype=float),(a,b,c,d))
 for j in range(nv+1):
  t=j/nv
  for i in range(nu+1):
   s=i/nu;new_v.append(((1-s)*(1-t)*a+s*(1-t)*b+s*t*c+(1-s)*t*d).tolist())
 for j in range(nv):
  for i in range(nu):
   a0=start+j*(nu+1)+i;b0=a0+1;d0=a0+nu+1;c0=d0+1
   new_f.extend([[a0,d0,b0],[b0,d0,c0]])
nx=int(np.ceil((xmax-xmin)/.075));nz=int(np.ceil((zmax-zmin)/.075));bottom=height-thickness
# Top and bottom; side faces form a closed slab after positional welding.
surface([xmin,height,zmin],[xmax,height,zmin],[xmax,height,zmax],[xmin,height,zmax],nx,nz)
surface([xmin,bottom,zmax],[xmax,bottom,zmax],[xmax,bottom,zmin],[xmin,bottom,zmin],nx,nz)
surface([xmin,bottom,zmin],[xmax,bottom,zmin],[xmax,height,zmin],[xmin,height,zmin],nx,1)
surface([xmax,bottom,zmax],[xmin,bottom,zmax],[xmin,height,zmax],[xmax,height,zmax],nx,1)
surface([xmin,bottom,zmax],[xmin,bottom,zmin],[xmin,height,zmin],[xmin,height,zmax],nz,1)
surface([xmax,bottom,zmin],[xmax,bottom,zmax],[xmax,height,zmax],[xmax,height,zmin],nz,1)
slab_v=np.array(new_v,dtype='<f4');slab_f=np.array(new_f,dtype='<u4')
slab_v,inverse=np.unique(slab_v,axis=0,return_inverse=True);slab_f=inverse[slab_f].astype('<u4')
def write_mesh(path,vertices,faces):
 with path.open('xb') as file:
  file.write((f'ply\nformat binary_little_endian 1.0\nelement vertex {len(vertices)}\nproperty float32 x\nproperty float32 y\nproperty float32 z\nelement face {len(faces)}\nproperty list uint8 uint32 vertex_indices\nend_header\n').encode())
  vertices.astype('<f4').tofile(file);r=np.empty(len(faces),dtype=[('n','u1'),('v','<u4',(3,))]);r['n']=3;r['v']=faces;r.tofile(file)
combined_v=np.concatenate([v,slab_v]);combined_f=np.concatenate([kept,slab_f+len(v)])
write_mesh(target,combined_v,combined_f);write_mesh(out/'tabletop-inferred.ply',slab_v,slab_f)
np.savez_compressed(out/'removed-face-record.npz',removed_indices=np.flatnonzero(remove),removed_faces=f[remove])
report={'method':'Continuous tabletop slab inferred from surviving rim; selected damaged surface faces removed; source-based objects retained.','rim_fit_samples':int(rim.sum()),'bounds_xz':[xmin,xmax,zmin,zmax],'top_y':height,'slab_thickness_assumption':thickness,'units':'scene coordinate units; not independently measured','protected_objects':objects,'input_triangles':len(f),'removed_triangles':int(remove.sum()),'retained_triangles':len(kept),'new_tabletop_triangles':len(slab_f),'output_triangles':len(combined_f),'input_vertices_unchanged':True,'note':'This is a constrained replacement surface, not recovery of previously observed measurements. Door and chairs are not repaired.'}
(out/'table-repair-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
