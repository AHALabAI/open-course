from pathlib import Path
import json
import numpy as np
from analyze_holes import read_mesh,boundary_loops
root=Path(__file__).resolve().parent;out=root/'repairs/table-v01'
report=json.loads((out/'table-repair-report.json').read_text())
v,f=read_mesh(out/'tabletop-inferred.ply');loops,stats=boundary_loops(f)
assert len(loops)==0 and stats['boundary_edges']==0 and stats['nonmanifold_edges']==0
p=v[f].astype(float);cross=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]);area=np.linalg.norm(cross,axis=1)*.5
assert area.min()>1e-10
height=report['top_y'];top=np.all(np.abs(p[:,:,1]-height)<1e-6,axis=1)
xmin,xmax,zmin,zmax=report['bounds_xz'];expected_area=(xmax-xmin)*(zmax-zmin)
assert abs(area[top].sum()-expected_area)<1e-5 and np.all(cross[top,1]>0)
edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);unique,counts=np.unique(edges,axis=0,return_counts=True)
assert np.all(counts==1) and len({tuple(e) for e in unique})==len(unique)
edge_set={tuple(e) for e in unique}
assert all((int(b),int(a)) in edge_set for a,b in unique)
old_v,old_f=read_mesh(root/'repairs/planar-v01/scene_patched.ply');new_v,new_f=read_mesh(out/'scene_table_repaired.ply')
record=np.load(out/'removed-face-record.npz');removed=record['removed_indices'];keep=np.ones(len(old_f),dtype=bool);keep[removed]=False
assert np.array_equal(old_f[removed],record['removed_faces'])
assert np.array_equal(old_v,new_v[:len(old_v)])
assert np.array_equal(old_f[keep],new_f[:keep.sum()])
assert np.array_equal(new_f[keep.sum():]-len(old_v),f)
data={'status':'passed','slab_closed':True,'slab_boundary_edges':0,'slab_nonmanifold_edges':0,'slab_consistent_winding':True,'top_area_scene_units_squared':float(area[top].sum()),'expected_rectangle_area':expected_area,'original_vertices_preserved':len(old_v),'retained_faces_exactly_unchanged':int(keep.sum()),'removed_faces_recorded':len(removed),'new_slab_faces':len(f),'scope':'The replacement tabletop is closed and covers its inferred rectangle. This does not certify entire room closure, physical dimensions or absence of all visual texture artifacts.'}
(out/'geometry-verification.json').write_text(json.dumps(data,indent=2));print(json.dumps(data,indent=2))
