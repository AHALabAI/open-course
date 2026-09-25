from pathlib import Path
import json
import numpy as np
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/door-v01';report=json.loads((out/'door-repair-report.json').read_text())
old,ob=read_glb(root/'repairs/table-v01/office-table-repaired.glb');new,nb=read_glb(out/'office-door-repaired.glb')
def image_bytes(doc,binary,index):
 v=doc['bufferViews'][doc['images'][index]['bufferView']];a=v.get('byteOffset',0);return binary[a:a+v['byteLength']]
for i in range(len(old['images'])):assert image_bytes(old,ob,i)==image_bytes(new,nb,i)
assert image_bytes(new,nb,2)==(root/'source/images/3_REN0406.jpg').read_bytes()
assert image_bytes(new,nb,3)==(root/'source/images/6_REN0433.jpg').read_bytes()
lo,hi=np.array(report['clip_bounds']);unchanged=0
for a,b in zip(old['meshes'][0]['primitives'],new['meshes'][0]['primitives']):
 v=accessor(old,ob,a['attributes']['POSITION']);uv=accessor(old,ob,a['attributes']['TEXCOORD_0']);f=accessor(old,ob,a['indices']).reshape(-1,3)
 vv=accessor(new,nb,b['attributes']['POSITION']);tt=accessor(new,nb,b['attributes']['TEXCOORD_0']);ff=accessor(new,nb,b['indices']).reshape(-1,3)
 assert np.array_equal(v,vv[:len(v)]) and np.array_equal(uv,tt[:len(uv)])
 p=v[f];intersects=np.all(p.max(1)>=lo,axis=1)&np.all(p.min(1)<=hi,axis=1);keep=f[~intersects]
 assert np.array_equal(keep,ff[:len(keep)]);unchanged+=len(keep)
 centers=vv[ff].mean(1);assert not np.any(np.all(centers>lo+1e-6,axis=1)&np.all(centers<hi-1e-6,axis=1))
node=next(n for n in new['nodes'] if n.get('name')=='inferred_door');primitives=new['meshes'][node['mesh']]['primitives']
backing=primitives[0];v=accessor(new,nb,backing['attributes']['POSITION']);f=accessor(new,nb,backing['indices']).reshape(-1,3)[:12]
edges=np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True);assert np.all(counts==2)
for p in primitives:
 uv=accessor(new,nb,p['attributes']['TEXCOORD_0']);assert np.all(uv>=0) and np.all(uv<=1)
 assert new['materials'][p['material']]['alphaMode']=='OPAQUE'
data={'status':'passed','unchanged_outside_triangles':unchanged,'original_position_and_uv_arrays_preserved':True,'old_texture_images_byte_identical':len(old['images']),'door_and_wall_source_jpegs_byte_identical':True,'old_fragments_inside_door_roi_remaining':0,'photo_backing_box_closed':True,'new_uvs_within_texture':True,'glass_material':'OPAQUE photo-backed; not a transparent reconstruction','scope':'Asset integrity and bounded geometry replacement; not entire-room watertightness, measured dimensions or an operable door.'}
(out/'geometry-verification.json').write_text(json.dumps(data,indent=2));print(json.dumps(data,indent=2))
