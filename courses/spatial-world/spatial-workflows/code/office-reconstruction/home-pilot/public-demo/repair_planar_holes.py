"""Blender Python: conservative planar boundary completion, preserving the observed mesh."""
from pathlib import Path
import json,sys
import numpy as np
import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from analyze_holes import read_mesh,boundary_loops,describe
out=ROOT/'repairs/planar-v01';out.mkdir(parents=True,exist_ok=True)
target=out/'scene_patched.ply'
if target.exists():raise FileExistsError(target)
vertices,faces=read_mesh(ROOT/'runs/office-v01/mvs/scene_dense_mesh.ply')
loops,before=boundary_loops(faces)
all_vertices=vertices.tolist();extra_faces=[];records=[]
directed={tuple(e) for f in faces for e in [(int(f[0]),int(f[1])),(int(f[1]),int(f[2])),(int(f[2]),int(f[0]))]}
for index,loop in enumerate(loops):
 info=dict(id=index,**describe(vertices,loop))
 if info['plane_rms']>.05 or max(abs(x) for x in info['normal'])<.99:
  records.append(dict(**info,action='preserved: non-planar or mixed structure'));continue
 p=vertices[loop].astype(float);center=p.mean(0);_,_,basis=np.linalg.svd(p-center,full_matrices=False)
 uv=(p-center)@basis[:2].T
 vectors=[Vector((float(a),float(b),0)) for a,b in uv]
 triangles=tessellate_polygon([vectors])
 local_points=p.tolist();local_triangles=[]
 for triangle in triangles:
  ids=[int(v) if isinstance(v,int) else int(np.argmin(np.sum((uv-np.array([v.x,v.y]))**2,axis=1))) for v in triangle]
  if len(set(ids))<3:continue
  local_triangles.append(ids)
 # Preserve every boundary edge. Subdivide only interior edges for multi-view texturing.
 for iteration in range(7):
  from collections import Counter
  counts=Counter(tuple(sorted((a,b))) for f in local_triangles for a,b in zip(f,f[1:]+f[:1]))
  mids={}
  for (a,b),count in counts.items():
   if count==2 and np.linalg.norm(np.array(local_points[a])-local_points[b])>.18:
    mids[(a,b)]=len(local_points);local_points.append(((np.array(local_points[a])+local_points[b])*.5).tolist())
  if not mids:break
  refined=[]
  for f in local_triangles:
   mid=[mids.get(tuple(sorted((f[i],f[(i+1)%3])))) for i in range(3)]
   n=sum(m is not None for m in mid)
   if n==0:refined.append(f)
   elif n==3:
    a,b,c=f;x,y,z=mid;refined.extend([[a,x,z],[x,b,y],[z,y,c],[x,y,z]])
   else:
    start=next(i for i in range(3) if mid[i] is not None and (n==1 or mid[(i+1)%3] is not None))
    a,b,c=[f[(start+i)%3] for i in range(3)];x=mid[start]
    if n==1:refined.extend([[a,x,c],[x,b,c]])
    else:
     y=mid[(start+1)%3];refined.extend([[b,y,x],[a,x,c],[x,y,c]])
  local_triangles=refined
 mapping=list(loop)+list(range(len(all_vertices),len(all_vertices)+len(local_points)-len(loop)))
 all_vertices.extend(local_points[len(loop):])
 local_faces=[[mapping[i] for i in f] for f in local_triangles]
 # Align patch winding with adjacent observed faces across its shared boundary.
 patch_edges={(a,b) for f in local_faces for a,b in zip(f,f[1:]+f[:1])}
 same=sum((loop[i],loop[(i+1)%len(loop)]) in directed and (loop[i],loop[(i+1)%len(loop)]) in patch_edges for i in range(len(loop)))
 opposite=sum((loop[i],loop[(i+1)%len(loop)]) in directed and (loop[(i+1)%len(loop)],loop[i]) in patch_edges for i in range(len(loop)))
 if same>opposite:local_faces=[f[::-1] for f in local_faces]
 extra_faces.extend(local_faces);records.append(dict(**info,action='planar boundary completion',added_triangles=len(local_faces)))
all_vertices=np.asarray(all_vertices,dtype='<f4');combined=np.concatenate([faces,np.asarray(extra_faces,dtype='<u4')])
def write_ply(path,verts,tris):
 with path.open('xb') as f:
  f.write(('ply\nformat binary_little_endian 1.0\nelement vertex '+str(len(verts))+'\nproperty float32 x\nproperty float32 y\nproperty float32 z\nelement face '+str(len(tris))+'\nproperty list uint8 uint32 vertex_indices\nend_header\n').encode())
  verts.tofile(f);r=np.empty(len(tris),dtype=[('n','u1'),('v','<u4',(3,))]);r['n']=3;r['v']=tris;r.tofile(f)
write_ply(target,all_vertices,combined)
remaining,after=boundary_loops(combined)
assert after['nonmanifold_edges']==0
assert len(remaining)==2, 'Expected exactly the two deliberately unfilled non-planar loops'
assert np.array_equal(all_vertices[:len(vertices)],vertices) and np.array_equal(combined[:len(faces)],faces)
report={'method':'Fill near-planar closed boundary loops; interior-only subdivision; original vertices and triangles unchanged. Added surfaces are inferred, not newly measured.','before':before,'after':after,'closed_loops_before':len(loops),'closed_loops_after':len(remaining),'original_triangles':len(faces),'added_triangles':len(extra_faces),'total_triangles':len(combined),'loops':records}
(out/'repair-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='loops'},indent=2))
