"""Replace noisy wall and ceiling bands by explicitly inferred textured planes.
Furniture/door meshes and all original embedded images remain byte-identical.
"""
from pathlib import Path
import json,copy,hashlib,shutil,numpy as np
from glb_mesh_tools import read_glb,accessor,Builder
root=Path(__file__).resolve().parent;out=root/'repairs/envelope-v01'
source=root/'repairs/room-v01/office-room-final.glb';doc,raw=read_glb(source);builder=Builder(doc)
target=out/'office-envelope-final.glb'
if target.exists():raise FileExistsError(target)
for im in builder.doc['images']:
 v=doc['bufferViews'][im['bufferView']];start=v.get('byteOffset',0);im['bufferView']=builder.blob(raw[start:start+v['byteLength']])
regions=[('ceiling',[-4,2.31,-4],[4,4,4]),('corner_pilaster',[2.10,.005,-3],[3,2.44,-1.46]),('left_wall',[-4,.08,-4],[-2.28,2.31,4]),('right_wall',[2.38,.08,-4],[4,2.31,4]),('front_wall',[-4,.08,-4],[4,2.31,-2.01]),('back_wall',[-4,.08,1.92],[4,2.31,4])]
def clip(poly,axis,limit,greater):
 result=[]
 for i,a in enumerate(poly):
  c=poly[(i+1)%len(poly)];da=(a[axis]-limit)*(1 if greater else -1);dc=(c[axis]-limit)*(1 if greater else -1)
  if da>=-1e-10:result.append(a)
  if (da>=-1e-10)!=(dc>=-1e-10):result.append(a+(c-a)*(da/(da-dc)))
 return result
records=[]
for mi,mesh in enumerate(doc['meshes']):
 prims=[]
 for pi,p in enumerate(mesh['primitives']):
  if mi!=0:
   q=copy.deepcopy(p);q['attributes']={key:builder.array(accessor(doc,raw,ai),doc['accessors'][ai]['type']) for key,ai in p['attributes'].items()};q['indices']=builder.array(accessor(doc,raw,p['indices']),'SCALAR');prims.append(q);continue
  v=accessor(doc,raw,p['attributes']['POSITION']);uv=accessor(doc,raw,p['attributes']['TEXCOORD_0']);f=accessor(doc,raw,p['indices']).reshape(-1,3)
  for name,lo,hi in regions:
   lo=np.array(lo);hi=np.array(hi);tri=v[f];candidate=(tri.max(1)>=lo).all(1)&(tri.min(1)<=hi).all(1);inside=(tri.min(1)>=lo).all(1)&(tri.max(1)<=hi).all(1);boundary=candidate&~inside;extra=[]
   for face in f[boundary]:
    remaining=[np.r_[v[i],uv[i]].astype(float) for i in face]
    for axis in range(3):
     for bound,greater in [(lo[axis],True),(hi[axis],False)]:
      outside=clip(remaining,axis,bound,not greater)
      for j in range(1,len(outside)-1):
       t=np.array([outside[0],outside[j],outside[j+1]])
       if np.linalg.norm(np.cross(t[1,:3]-t[0,:3],t[2,:3]-t[0,:3]))>1e-10:extra.append(t)
      remaining=clip(remaining,axis,bound,greater)
      if not remaining:break
     if not remaining:break
   extra=np.array(extra).reshape(-1,5);newf=np.arange(len(v),len(v)+len(extra),dtype=np.uint32).reshape(-1,3)
   records.append({'primitive':pi,'region':name,'before':len(f),'removed_candidates':int(candidate.sum()),'unaffected':int((~candidate).sum()),'retained_boundary_fragments':len(newf)})
   f=np.concatenate([f[~candidate],newf]);v=np.concatenate([v,extra[:,:3]]);uv=np.concatenate([uv,extra[:,3:]])
  ids,inverse=np.unique(f,return_inverse=True);prims.append(builder.primitive(v[ids],inverse.reshape(-1,3),p['material'],uv[ids]))
 builder.doc['meshes'][mi]['primitives']=prims
od,ob=read_glb(root/'repairs/room-v01/room-repair-overlay-final.glb');overlay=Builder(od)
for mi,m in enumerate(od['meshes']):
 overlay.doc['meshes'][mi]['primitives']=[overlay.primitive(accessor(od,ob,p['attributes']['POSITION']),accessor(od,ob,p['indices']).reshape(-1,3),p['material']) for p in m['primitives']]
plan=json.loads((out/'surface-plan-finished.json').read_text())
for s in plan['surfaces']:
 o=np.array(s['origin']);u=np.array(s['u']);v=np.array(s['v']);positions=np.array([o,o+u,o+u+v,o+v]);faces=np.array([[0,1,2],[0,2,3]],np.uint32);uv=np.array([[0,0],[1,0],[1,1],[0,1]])
 if np.dot(np.cross(u,v),s['normal'])<0:faces=faces[:,::-1]
 data=(out/s.get('texture_file',s['name']+'.png')).read_bytes();im=len(builder.doc['images']);builder.doc['images'].append({'bufferView':builder.blob(data),'mimeType':'image/png','name':'calibrated_'+s['name']})
 tx=len(builder.doc['textures']);builder.doc['textures'].append({'source':im});mat=len(builder.doc['materials']);builder.doc['materials'].append({'name':'replacement_envelope_'+s['name'],'doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':tx},'metallicFactor':0,'roughnessFactor':1},'extensions':{'KHR_materials_unlit':{}},'extras':{'provenance':'Inferred planar envelope, calibrated public photo reprojection, fixed appearance'}})
 p=builder.primitive(positions,faces,mat,uv);p['attributes']['NORMAL']=builder.array(np.tile(s['normal'],(4,1)),'VEC3');builder.node([p],'inferred_envelope_'+s['name'],{'source_images':s['sources'],'unobserved_fraction':s['unobserved_fraction'],'geometry':'Planar design constraint, not measured architectural accuracy'})
 overlay.node([overlay.primitive(positions,faces,0)],'inferred_envelope_'+s['name'])
builder.save(target);overlay.save(out/'envelope-overlay.glb')
for p in [target,out/'envelope-overlay.glb']:shutil.copy2(p,root/'viewer/assets'/p.name)
report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'regions':regions,'clipping':records,'surfaces':plan['surfaces'],'preserved':'All separate furniture and door primitives, material definitions, old texture image bytes','limits':['Planar architectural approximation; room dimensions not independently measured','Photo appearance includes fixed reflections; unobserved texture fill is inferred','Small ceiling fittings represented in planar texture, not fully modeled objects','No claim of whole-scene watertightness or collision readiness']}
(out/'envelope-repair-report.json').write_text(json.dumps(report,indent=2));print('Envelope GLB ready',target.stat().st_size,flush=True)
