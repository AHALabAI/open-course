"""Inspect actual mesh boundary loops before making any repair."""
from pathlib import Path
import json
import numpy as np
ROOT=Path(__file__).resolve().parent
def read_mesh(path):
 with Path(path).open('rb') as f:
  header=[]
  while True:
   line=f.readline().decode().strip();header.append(line)
   if line=='end_header':break
  assert 'format binary_little_endian 1.0' in header
  nv=int(next(x for x in header if x.startswith('element vertex')).split()[-1])
  nf=int(next(x for x in header if x.startswith('element face')).split()[-1])
  vertices=np.fromfile(f,dtype='<f4',count=nv*3).reshape(-1,3)
  records=np.fromfile(f,dtype=[('n','u1'),('v','<u4',(3,))],count=nf)
  assert np.all(records['n']==3)
  return vertices,records['v'].copy()
def boundary_loops(faces):
 edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]])
 unique,counts=np.unique(np.sort(edges,axis=1),axis=0,return_counts=True)
 boundary=unique[counts==1];adj={}
 for a,b in boundary:
  adj.setdefault(int(a),[]).append(int(b));adj.setdefault(int(b),[]).append(int(a))
 visited=set();loops=[];irregular=0
 for start in adj:
  if start in visited:continue
  stack=[start];component=[]
  while stack:
   a=stack.pop()
   if a in visited:continue
   visited.add(a);component.append(a);stack.extend(adj[a])
  if not all(len(adj[a])==2 for a in component):irregular+=1;continue
  loop=[start];previous=start;current=adj[start][0]
  while current!=start:
   loop.append(current);following=next(x for x in adj[current] if x!=previous);previous,current=current,following
  loops.append(loop)
 return loops,{'boundary_edges':len(boundary),'irregular_components':irregular,'nonmanifold_edges':int(np.sum(counts>2))}
def describe(vertices,loop):
 p=vertices[loop].astype(float);center=p.mean(0);_,s,vh=np.linalg.svd(p-center,full_matrices=False)
 normal=vh[-1];uv=(p-center)@vh[:2].T
 area=abs(np.sum(uv[:,0]*np.roll(uv[:,1],-1)-np.roll(uv[:,0],-1)*uv[:,1]))*.5
 distance=(p-center)@normal
 return {'vertices':len(loop),'center':center.tolist(),'normal':normal.tolist(),'extent':np.ptp(p,axis=0).tolist(),'area':area,'plane_rms':float(np.sqrt(np.mean(distance**2))),'plane_max':float(np.max(np.abs(distance)))}
if __name__=='__main__':
 vertices,faces=read_mesh(ROOT/'runs/office-v01/mvs/scene_dense_mesh.ply')
 loops,stats=boundary_loops(faces)
 records=[dict(id=i,**describe(vertices,l)) for i,l in enumerate(loops)]
 out=ROOT/'repairs/planar-v01';out.mkdir(parents=True,exist_ok=True)
 (out/'boundary-analysis.json').write_text(json.dumps({'mesh_vertices':len(vertices),'mesh_faces':len(faces),**stats,'closed_loops':len(loops),'loops':records},indent=2))
 np.savez_compressed(out/'mesh-and-loops.npz',vertices=vertices,faces=faces,loops=np.array(loops,dtype=object))
 print(json.dumps(stats));print('closed loops',len(loops))
 for r in sorted(records,key=lambda x:x['area'],reverse=True)[:24]:print(json.dumps(r))
