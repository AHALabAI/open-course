"""Independent checks of exported bytes, unaffected faces, bounds and chair panels."""
from pathlib import Path
import json,hashlib,numpy as np
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/room-v01';old,ob=read_glb(root/'repairs/door-v01/office-door-repaired.glb');d,b=read_glb(out/'office-room-final.glb');report=json.loads((out/'room-repair-report-final.json').read_text())
def image_bytes(doc,raw,i):
 v=doc['bufferViews'][doc['images'][i]['bufferView']];start=v.get('byteOffset',0);return raw[start:start+v['byteLength']]
for i in range(len(old['images'])):assert image_bytes(old,ob,i)==image_bytes(d,b,i)
assert all('uri' not in i for i in d['images']) and len(d['buffers'])==1 and 'uri' not in d['buffers'][0]
total=0
for mesh in d['meshes']:
 for p in mesh['primitives']:
  v=accessor(d,b,p['attributes']['POSITION']);f=accessor(d,b,p['indices']);assert f.max()<len(v);assert len(f)%3==0;total+=len(f)//3
  for name,i in p['attributes'].items():
   a=accessor(d,b,i);assert len(a)==len(v) and np.isfinite(a).all()
   if name=='NORMAL':assert np.allclose(np.linalg.norm(a,axis=1),1,atol=1e-5)
outside_kept=0
for pi,p in enumerate(old['meshes'][0]['primitives']):
 q=d['meshes'][0]['primitives'][pi];v=accessor(old,ob,p['attributes']['POSITION']);f=accessor(old,ob,p['indices']).reshape(-1,3);vv=accessor(d,b,q['attributes']['POSITION']);ff=accessor(d,b,q['indices']).reshape(-1,3)
 assert np.array_equal(v,vv[:len(v)]);uv=accessor(old,ob,p['attributes']['TEXCOORD_0']);assert np.array_equal(uv,accessor(d,b,q['attributes']['TEXCOORD_0'])[:len(uv)])
 tri=v[f];candidate=np.zeros(len(f),bool)
 for _,lo,hi in report['clip_regions']:candidate|=(tri.max(1)>=lo).all(1)&(tri.min(1)<=hi).all(1)
 kept={tuple(x) for x in ff};assert all(tuple(x) in kept for x in f[~candidate]);outside_kept+=int((~candidate).sum())
 centers=vv[ff].mean(1)
 for _,lo,hi in report['clip_regions']:assert not np.any((centers>np.array(lo)+1e-6).all(1)&(centers<np.array(hi)-1e-6).all(1))
# Previously repaired door remains byte-identical as arrays and material references.
for p,q in zip(old['meshes'][1]['primitives'],d['meshes'][1]['primitives']):
 assert p['material']==q['material']
 for key in p['attributes']:assert np.array_equal(accessor(old,ob,p['attributes'][key]),accessor(d,b,q['attributes'][key]))
 assert np.array_equal(accessor(old,ob,p['indices']),accessor(d,b,q['indices']))
chairs=[n for n in d['nodes'] if n.get('name','').startswith('inferred_chair_')];assert len(chairs)==5;panels=[]
for n in chairs:
 p=next(p for p in d['meshes'][n['mesh']]['primitives'] if d['materials'][p['material']]['name']=='replacement_woven_back');v=accessor(d,b,p['attributes']['POSITION']);f=accessor(d,b,p['indices']).reshape(-1,3);weld,idx=np.unique(np.round(v,6),axis=0,return_inverse=True);f=idx[f];edges=np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1);_,count=np.unique(edges,axis=0,return_counts=True);assert (count==2).all();panels.append({'name':n['name'],'boundary_edges':int((count==1).sum()),'nonmanifold_edges':int((count>2).sum())})
floor=next(n for n in d['nodes'] if n.get('name')=='inferred_floor_patch');p=d['meshes'][floor['mesh']]['primitives'][0];v=accessor(d,b,p['attributes']['POSITION']);f=accessor(d,b,p['indices']).reshape(-1,3);assert np.allclose(v[:,[0,2]].min(0),[-1.30,-1.02]);assert np.allclose(v[:,[0,2]].max(0),[1.46,1.02]);t=v[f][:,:,[0,2]];a=t[:,1]-t[:,0];c=t[:,2]-t[:,0];area=np.abs(a[:,0]*c[:,1]-a[:,1]*c[:,0]).sum()/2;assert abs(area-2.76*2.04)<1e-4
r={'status':'passed','triangles':total,'bytes':(out/'office-room-final.glb').stat().st_size,'original_embedded_images_preserved':len(old['images']),'unaffected_source_faces_exact':outside_kept,'door_arrays_unchanged':True,'source_fragments_remaining_inside_clip_rois':0,'chair_panels':panels,'floor_patch_projected_area':float(area),'floor_expected_rectangle_area':2.76*2.04,'finite_and_in_bounds_accessors':True,'self_contained_glb':True,'scope':'Checks exported geometry and data preservation, not global watertightness, collisions or physical accuracy'}
(out/'geometry-verification.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
