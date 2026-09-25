"""Independent checks on observed geometry preservation and patch topology."""
from pathlib import Path
import json
import numpy as np
from analyze_holes import read_mesh,boundary_loops
root=Path(__file__).resolve().parent;out=root/'repairs/planar-v01'
original_v,original_f=read_mesh(root/'runs/office-v01/mvs/scene_dense_mesh.ply')
v,f=read_mesh(out/'scene_patched.ply');patch=f[len(original_f):]
assert np.array_equal(v[:len(original_v)],original_v)
assert np.array_equal(f[:len(original_f)],original_f)
loops,stats=boundary_loops(f)
assert stats['nonmanifold_edges']==0 and stats['irregular_components']==0 and len(loops)==2
directed={(int(a),int(b)) for x in original_f for a,b in zip(x,np.roll(x,-1))}
shared=[(int(a),int(b)) for x in patch for a,b in zip(x,np.roll(x,-1)) if (int(a),int(b)) in directed or (int(b),int(a)) in directed]
assert len(shared)==336 and not any(e in directed for e in shared)
area2=np.linalg.norm(np.cross(v[patch[:,1]]-v[patch[:,0]],v[patch[:,2]]-v[patch[:,0]]),axis=1)
assert not np.any(area2<1e-10)
assert len(np.unique(np.sort(patch,axis=1),axis=0))==len(patch)
report={'status':'passed','original_vertices_exactly_preserved':len(original_v),'original_triangles_exactly_preserved':len(original_f),'added_triangles':len(patch),'consistently_oriented_shared_boundary_edges':len(shared),'duplicate_added_triangles':0,'near_zero_area_added_triangles':0,'remaining_closed_boundary_loops':len(loops),**stats,'scope':'Topology and original-geometry preservation; no claim of measured accuracy of inferred surfaces.'}
(out/'geometry-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
