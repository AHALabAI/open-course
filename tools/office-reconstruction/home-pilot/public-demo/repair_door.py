"""Replace broken door ROI with a framed, photo-backed door; retain other texture bytes."""
from pathlib import Path
import json,hashlib,shutil,copy
import numpy as np
from glb_mesh_tools import read_glb,accessor,Builder
root=Path(__file__).resolve().parent;out=root/'repairs/door-v01';plan=json.loads((out/'door-plan.json').read_text());b=plan['bounds']
source=root/'repairs/table-v01/office-table-repaired.glb';doc,binary=read_glb(source)
assert doc['nodes']==[{'mesh':0,'name':'node'}], 'Only identity source mesh supported'
builder=Builder(doc)
for image in builder.doc['images']:
 old=doc['bufferViews'][image['bufferView']];offset=old.get('byteOffset',0);image['bufferView']=builder.blob(binary[offset:offset+old['byteLength']])
# Remove broken faces inside the door column, including untrustworthy fragments behind glass.
lower=np.array([b['xmin'],b['ymin']-.015,1.90]);upper=np.array([b['xmax'],b['ymax'],3.70])
def clip(poly,axis,limit,greater):
 if not poly:return []
 result=[]
 for i,a in enumerate(poly):
  c=poly[(i+1)%len(poly)];da=(a[axis]-limit)*(1 if greater else -1);dc=(c[axis]-limit)*(1 if greater else -1)
  if da>=-1e-10:result.append(a)
  if (da>=-1e-10)!=(dc>=-1e-10):result.append(a+(c-a)*(da/(da-dc)))
 return result
records=[]
for mi,mesh in enumerate(doc['meshes']):
 new_primitives=[]
 for pi,primitive in enumerate(mesh['primitives']):
  assert set(primitive['attributes'])=={'POSITION','TEXCOORD_0'}
  v=accessor(doc,binary,primitive['attributes']['POSITION']);uv=accessor(doc,binary,primitive['attributes']['TEXCOORD_0']);faces=accessor(doc,binary,primitive['indices']).reshape(-1,3)
  triangles=v[faces];candidate=np.all(triangles.max(1)>=lower,axis=1)&np.all(triangles.min(1)<=upper,axis=1)
  retained=faces[~candidate];extra_v=[];extra_uv=[];extra_f=[]
  for face in faces[candidate]:
   remaining=[np.r_[v[i],uv[i]].astype(float) for i in face]
   for axis in range(3):
    for bound,greater in [(lower[axis],True),(upper[axis],False)]:
     outside=clip(remaining,axis,bound,not greater)
     if len(outside)>=3:
      for j in range(1,len(outside)-1):
       tri=np.array([outside[0],outside[j],outside[j+1]])
       if np.linalg.norm(np.cross(tri[1,:3]-tri[0,:3],tri[2,:3]-tri[0,:3]))<1e-10:continue
       start=len(v)+len(extra_v);extra_v.extend(tri[:,:3]);extra_uv.extend(tri[:,3:]);extra_f.append([start,start+1,start+2])
     remaining=clip(remaining,axis,bound,greater)
     if not remaining:break
    if not remaining:break
  vv=np.concatenate([v,np.asarray(extra_v).reshape(-1,3)]);tt=np.concatenate([uv,np.asarray(extra_uv).reshape(-1,2)]);ff=np.concatenate([retained,np.asarray(extra_f,dtype=np.uint32).reshape(-1,3)])
  new_primitives.append(builder.primitive(vv,ff,primitive['material'],tt))
  records.append({'mesh':mi,'primitive':pi,'input_triangles':len(faces),'unaffected_triangles_kept_exactly':len(retained),'candidate_triangles_clipped':int(candidate.sum()),'outside_fragment_triangles':len(extra_f),'retained_triangles':len(ff)})
 builder.doc['meshes'][mi]['primitives']=new_primitives
view=plan['texture_source'];camera=np.array(view['position']);R=np.array(view['rotation_camera_to_world']);k=view['intrinsics']
def projected_uv(vertices,source_view=None):
 c,r,intr=(camera,R,k) if source_view is None else (np.array(source_view['position']),np.array(source_view['rotation_camera_to_world']),source_view['intrinsics'])
 q=(vertices-c)@r;pixels=q[:,:2]/q[:,2,None]*[intr['fx'],intr['fy']]+[intr['cx'],intr['cy']]
 return (pixels/[intr['width'],intr['height']]).astype('<f4')
photo=root/'source/images'/view['image'];image=len(builder.doc['images']);builder.doc['images'].append({'bufferView':builder.blob(photo.read_bytes()),'mimeType':'image/jpeg','name':'original_public_door_photo'})
sampler=len(builder.doc.setdefault('samplers',[]));builder.doc['samplers'].append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071})
texture=len(builder.doc['textures']);builder.doc['textures'].append({'source':image,'sampler':sampler})
material=len(builder.doc['materials']);builder.doc['materials'].append({'name':'door_photo_baked_opaque','doubleSided':True,'alphaMode':'OPAQUE','pbrMetallicRoughness':{'baseColorTexture':{'index':texture},'metallicFactor':0,'roughnessFactor':1},'extensions':{'KHR_materials_unlit':{}},'extras':{'glass':'Fixed photo appearance, not transparent reconstructed space'}})
positions=[];indices=[];parts=[]
def box(x0,x1,y0,y1,z0,z1,name):
 start=len(positions);points=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];positions.extend(points)
 for a,c,d,e in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]:indices.extend([[start+a,start+c,start+d],[start+a,start+d,start+e]])
 parts.append({'name':name,'bounds':[x0,x1,y0,y1,z0,z1]})
# The opaque photo-backed slab closes the visible door region without inventing a hallway.
box(b['xmin'],b['xmax'],b['ymin'],b['ymax'],2.025,2.075,'photo_backed_door')
box(b['xmin'],b['xmin']+.055,0,b['ymax'],1.998,2.075,'right_jamb')
box(b['xmax']-.055,b['xmax'],0,b['ymax'],1.998,2.075,'left_jamb')
box(b['xmin'],b['xmax'],b['ymax']-.055,b['ymax'],1.998,2.075,'header')
box(b['xmin'],b['xmax'],0,.035,1.998,2.075,'threshold')
box(b['xmin'],b['xmax'],-.018,.005,1.895,2.075,'threshold_floor_bridge')
box(1.34,1.405,.035,b['ymax']-.055,1.998,2.075,'center_mullion')
# White door leaf and its recessed vision panel use the same calibrated photo, preserving signage.
box(1.405,1.65,.035,2.115,2.005,2.032,'leaf_lock_stile')
box(2.08,2.305,.035,2.115,2.005,2.032,'leaf_hinge_stile')
box(1.65,2.08,1.885,2.115,2.005,2.032,'leaf_top_rail')
box(1.65,2.08,.035,.245,2.005,2.032,'leaf_bottom_rail')
door_v=np.asarray(positions,dtype='<f4');door_f=np.asarray(indices,dtype='<u4');uv=projected_uv(door_v)
assert np.all(uv>=0) and np.all(uv<=1)
door_primitive=builder.primitive(door_v,door_f,material,uv)
# Small adjacent wall gap retained by the old non-planar boundary is completed on its wall plane.
positions=[];indices=[]
box(-.28,.24,1.95,2.31,2.025,2.04,'adjacent_wall_patch')
wall_v=np.asarray(positions,dtype='<f4');wall_f=np.asarray(indices,dtype='<u4')
wall_view=next(v for v in json.loads((root/'runs/office-v01/cameras.json').read_text()) if v['image']=='6_REN0433.jpg')
line=next(line for line in (root/'runs/office-v01/dense/sparse/cameras.txt').read_text().splitlines() if line.startswith('6 ')).split()
wall_view['intrinsics']=dict(zip(['width','height','fx','fy','cx','cy'],map(float,line[2:])))
wall_photo=root/'source/images'/wall_view['image'];wall_image=len(builder.doc['images']);builder.doc['images'].append({'bufferView':builder.blob(wall_photo.read_bytes()),'mimeType':'image/jpeg','name':'door_surround_public_photo'})
wall_texture=len(builder.doc['textures']);builder.doc['textures'].append({'source':wall_image,'sampler':sampler})
wall_material=len(builder.doc['materials']);m=copy.deepcopy(builder.doc['materials'][material]);m['name']='inferred_adjacent_wall_photo';m['pbrMetallicRoughness']['baseColorTexture']['index']=wall_texture;m['extras']={'provenance':'Small adjacent wall gap filled on an inferred plane'};builder.doc['materials'].append(m)
wall_uv=projected_uv(wall_v,wall_view);assert np.all(wall_uv>=0) and np.all(wall_uv<=1)
builder.node([door_primitive,builder.primitive(wall_v,wall_f,wall_material,wall_uv)],'inferred_door',{'provenance':plan['provenance'],'source_image':view['image']})
target=out/'office-door-repaired.glb';builder.save(target);shutil.copy2(target,root/'viewer/assets'/target.name);shutil.copy2(photo,root/'viewer/assets'/photo.name)
overlay_doc,overlay_bin=read_glb(root/'repairs/table-v01/table-repair-overlay.glb');overlay=Builder(overlay_doc)
for mi,mesh in enumerate(overlay_doc['meshes']):
 overlay.doc['meshes'][mi]['primitives']=[overlay.primitive(accessor(overlay_doc,overlay_bin,p['attributes']['POSITION']),accessor(overlay_doc,overlay_bin,p['indices']).reshape(-1,3),p['material']) for p in mesh['primitives']]
overlay.node([overlay.primitive(door_v,door_f,0),overlay.primitive(wall_v,wall_f,0)],'inferred_door');overlay_path=out/'door-repair-overlay.glb';overlay.save(overlay_path);shutil.copy2(overlay_path,root/'viewer/assets'/overlay_path.name)
report={'status':'created','source_file':str(source),'output':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'clip_bounds':[lower.tolist(),upper.tolist()],'clipping':records,'door_triangles':len(door_f),'parts':parts,'source_photo':view['image'],'existing_texture_bytes_preserved':True,'glass_mode':'Opaque single-view photo-backed appearance; no transparent or navigable space behind door claimed','provenance':plan['provenance']}
(out/'door-repair-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['parts','provenance']},indent=2))
