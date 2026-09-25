"""Check preserved assets and the seven explicitly inferred envelope planes."""
from pathlib import Path
import hashlib,json,numpy as np
from glb_mesh_tools import read_glb,accessor
root=Path(__file__).resolve().parent;out=root/'repairs/envelope-v01'
source=root/'repairs/room-v01/office-room-final.glb';target=out/'office-envelope-final.glb'
old,ob=read_glb(source);new,nb=read_glb(target)
report=json.loads((out/'envelope-repair-report.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest()==report['source_sha256']
assert hashlib.sha256(target.read_bytes()).hexdigest()==report['sha256']
def blob(d,b,i):
    v=d['bufferViews'][i];s=v.get('byteOffset',0);return b[s:s+v['byteLength']]
for a,b in zip(old['images'],new['images']):assert blob(old,ob,a['bufferView'])==blob(new,nb,b['bufferView'])
assert new['materials'][:len(old['materials'])]==old['materials']
for mi in range(1,len(old['meshes'])):
    assert len(old['meshes'][mi]['primitives'])==len(new['meshes'][mi]['primitives'])
    for a,b in zip(old['meshes'][mi]['primitives'],new['meshes'][mi]['primitives']):
        assert a['material']==b['material'] and a['attributes'].keys()==b['attributes'].keys()
        for key in a['attributes']:assert np.array_equal(accessor(old,ob,a['attributes'][key]),accessor(new,nb,b['attributes'][key]))
        assert np.array_equal(accessor(old,ob,a['indices']),accessor(new,nb,b['indices']))
faces=0;degenerate=0
for mesh in new['meshes']:
    for p in mesh['primitives']:
        v=accessor(new,nb,p['attributes']['POSITION']);f=accessor(new,nb,p['indices']).reshape(-1,3)
        assert np.isfinite(v).all() and f.min()>=0 and f.max()<len(v)
        for ai in p['attributes'].values():assert np.isfinite(accessor(new,nb,ai)).all()
        tri=v[f];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
        degenerate+=int((area<1e-12).sum());faces+=len(f)
planes=[]
for node in new['nodes']:
    if not node.get('name','').startswith('inferred_envelope_'):continue
    p=new['meshes'][node['mesh']]['primitives'][0];v=accessor(new,nb,p['attributes']['POSITION']);n=accessor(new,nb,p['attributes']['NORMAL']);f=accessor(new,nb,p['indices']).reshape(-1,3)
    assert v.shape==(4,3) and f.shape==(2,3)
    assert np.max(np.abs((v-v[0])@n[0]))<1e-6
    assert np.allclose(np.linalg.norm(n,axis=1),1)
    for tri in v[f]:assert np.dot(np.cross(tri[1]-tri[0],tri[2]-tri[0]),n[0])>0
    planes.append(node['name'])
assert len(planes)==7
result={'status':'passed','faces':faces,'bytes':target.stat().st_size,'mib':round(target.stat().st_size/1048576,1),'original_images_preserved':len(old['images']),'separate_meshes_preserved':len(old['meshes'])-1,'planes':planes,'near_zero_area_faces':degenerate,'whole_scene_watertightness_tested':False,'dimensional_accuracy_measured':False}
(out/'geometry-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
