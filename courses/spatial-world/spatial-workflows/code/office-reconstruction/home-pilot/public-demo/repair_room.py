"""Reversible hybrid asset pass: five observed chairs, table, props and two displays.

Replacements are approximate scene assets, not recovered or measured geometry.
All earlier GLBs and their image bytes are preserved. Only bounded ROIs are clipped.
"""
from pathlib import Path
import json,copy,hashlib,shutil,io
import numpy as np
from PIL import Image,ImageDraw
from glb_mesh_tools import read_glb,accessor,Builder
root=Path(__file__).resolve().parent;out=root/'repairs/room-v01'
doc,binary=read_glb(root/'repairs/door-v01/office-door-repaired.glb');builder=Builder(doc)
for im in builder.doc['images']:
 v=doc['bufferViews'][im['bufferView']];start=v.get('byteOffset',0);im['bufferView']=builder.blob(binary[start:start+v['byteLength']])
regions=[('furniture',[-1.30,-.06,-1.02],[1.46,1.19,1.02]),('displays',[-2.75,1.265,-1.515],[-2.10,2.095,1.405]),('conference_camera',[-2.36,1.035,-.29],[-1.99,1.28,.20])]
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
  v=accessor(doc,binary,p['attributes']['POSITION']);uv=accessor(doc,binary,p['attributes']['TEXCOORD_0']);f=accessor(doc,binary,p['indices']).reshape(-1,3)
  if mi==0:
   for name,lo,hi in regions:
    lo=np.array(lo);hi=np.array(hi);tri=v[f];mask=(tri.max(1)>=lo).all(1)&(tri.min(1)<=hi).all(1);extra=[]
    for face in f[mask]:
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
    records.append({'primitive':pi,'roi':name,'faces_before':len(f),'candidate_faces':int(mask.sum()),'unchanged_faces':int((~mask).sum()),'outside_fragments':len(newf)})
    f=np.concatenate([f[~mask],newf]);v=np.concatenate([v,extra[:,:3]]);uv=np.concatenate([uv,extra[:,3:]])
  prims.append(builder.primitive(v,f,p['material'],uv))
 builder.doc['meshes'][mi]['primitives']=prims
overlay_doc,overlay_bin=read_glb(root/'repairs/door-v01/door-repair-overlay.glb');overlay=Builder(overlay_doc)
for mi,m in enumerate(overlay_doc['meshes']):
 overlay.doc['meshes'][mi]['primitives']=[overlay.primitive(accessor(overlay_doc,overlay_bin,p['attributes']['POSITION']),accessor(overlay_doc,overlay_bin,p['indices']).reshape(-1,3),p['material']) for p in m['primitives']]
# Old tabletop overlay is superseded in this variant; retained for historical comparisons.
def material(name,color,rough=.75,texture=None,unlit=False):
 m={'name':'replacement_'+name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'roughnessFactor':rough,'metallicFactor':0}}
 if texture is not None:m['pbrMetallicRoughness']['baseColorTexture']={'index':texture}
 if unlit:m['extensions']={'KHR_materials_unlit':{}}
 i=len(builder.doc['materials']);builder.doc['materials'].append(m);return i
def texture(data,mime,name):
 i=len(builder.doc['images']);builder.doc['images'].append({'bufferView':builder.blob(data),'mimeType':mime,'name':name});t=len(builder.doc['textures']);builder.doc['textures'].append({'source':i});return t
black=material('charcoal_frame',[.018,.021,.023]);seat=material('seat',[.028,.031,.033]);white=material('tabletop',[.45,.455,.405]);edge=material('table_edge',[.33,.34,.30]);metal=material('dark_metal',[.045,.051,.056]);cream=material('cup',[.57,.57,.51]);blue=material('blue',[.022,.08,.20]);yellow=material('yellow',[.65,.48,.03]);red=material('red',[.40,.025,.02]);green=material('green',[.03,.18,.065]);wood=material('pencil_wood',[.36,.22,.085]);silver=material('silver',[.20,.23,.23])
im=Image.new('RGB',(256,512),(66,68,68));dr=ImageDraw.Draw(im)
for x in range(0,256,5):dr.line((x,0,x,511),fill=(41,43,44),width=2)
for y in range(0,512,6):dr.line((0,y,255,y),fill=(26,29,30),width=2)
buf=io.BytesIO();im.save(buf,format='PNG');meshmat=material('woven_back',[1,1,1],texture=texture(buf.getvalue(),'image/png','procedural_opaque_woven_back'))
plan=json.loads((out/'object-plan.json').read_text());photo_mats={}
def photo_mat(key):
 if key not in photo_mats:
  v=plan[key]['view'];photo_mats[key]=material(key,[1,1,1],texture=texture((root/'source/images'/v['image']).read_bytes(),'image/jpeg',v['image']),unlit=True)
 return photo_mats[key]
def projected(points,key):
 v=plan[key]['view'];k=v['intrinsics'];q=(np.asarray(points)-v['position'])@v['rotation_camera_to_world'];return (q[:,:2]/q[:,2,None]*[k['fx'],k['fy']]+[k['cx'],k['cy']])/[k['width'],k['height']]
class Geometry:
 def __init__(self):self.parts={}
 def add(self,v,f,mat,uv=None):
  v=np.asarray(v,float);f=np.asarray(f,int);t=v[f];valid=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)>1e-12;f=f[valid];t=v[f];normal=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-15)
  q=self.parts.setdefault(mat,{'v':[],'f':[],'n':[],'uv':[]});start=len(q['v']);q['v'].extend(t.reshape(-1,3));q['n'].extend(np.repeat(normal,3,axis=0));q['f'].extend(np.arange(start,start+len(f)*3).reshape(-1,3));q['uv'].extend(np.asarray(uv)[f].reshape(-1,2) if uv is not None else np.zeros((len(f)*3,2)))
 def box(self,lo,hi,mat):
  x,y,z=lo;X,Y,Z=hi;v=[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z],[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]];f=[]
  for a,b,c,d in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]:f.extend([[a,b,c],[a,c,d]])
  self.add(v,f,mat)
 def tube(self,a,b,r,mat,n=16):
  a=np.array(a,float);b=np.array(b,float);axis=b-a;axis/=np.linalg.norm(axis);u=np.cross(axis,[1,0,0] if abs(axis[0])<.8 else [0,0,1]);u/=np.linalg.norm(u);w=np.cross(axis,u);ring=np.array([r*(u*np.cos(t)+w*np.sin(t)) for t in np.arange(n)*2*np.pi/n]);v=np.concatenate([a+ring,b+ring,[a,b]]);f=[]
  for i in range(n):j=(i+1)%n;f.extend([[i,j,n+j],[i,n+j,n+i],[2*n,j,i],[2*n+1,n+i,n+j]])
  self.add(v,f,mat)
 def rounded(self,x0,x1,z0,z1,y0,y1,r,mat):
  ring=[]
  for cx,cz,start in [(x1-r,z1-r,0),(x0+r,z1-r,90),(x0+r,z0+r,180),(x1-r,z0+r,270)]:
   ring.extend([[cx+r*np.cos(t),cz+r*np.sin(t)] for t in np.deg2rad(np.arange(start,start+91,15))])
  n=len(ring);v=[[x,y0,z] for x,z in ring]+[[x,y1,z] for x,z in ring];f=[]
  for i in range(n):j=(i+1)%n;f.extend([[i,n+j,j],[i,n+i,n+j]])
  for i in range(1,n-1):f.extend([[0,i,i+1],[n,n+i+1,n+i]])
  self.add(v,f,mat)
 def emit(self,name,transform=None):
  prims=[];op=[]
  for mat,q in self.parts.items():
   v=np.array(q['v']);normal=np.array(q['n'])
   if transform is not None:
    R,t=transform;v=v@R.T+t;normal=normal@R.T
   p=builder.primitive(v,q['f'],mat,q['uv']);p['attributes']['NORMAL']=builder.array(normal,'VEC3');prims.append(p);op.append(overlay.primitive(v,q['f'],0))
  builder.node(prims,name,{'provenance':'Approximate procedural replacement constrained by public photos and surviving mesh; not measured reconstruction'});overlay.node(op,name)
  return sum(len(q['f']) for q in self.parts.values())
g=Geometry();g.rounded(-1.1810737,.92907685,-.6285574,.580811,.73315,.75815,.025,white)
# Cable access panel and small cable grommet inferred from the reference image.
g.box([-.74,.75835,-.13],[-.33,.760,.055],edge);g.box([-.735,.7601,-.125],[-.335,.761,.050],white);g.box([-.74,.7605,-.043],[-.33,.762,-.037],black);g.tube([-.185,.758,-.025],[-.185,.760,-.025],.026,edge,32);g.tube([-.185,.760,-.025],[-.185,.761,-.025],.012,black,24)
g.box([-.88,.68,-.40],[.63,.731,.35],metal)
for x in [-.87,.62]:
 for z in [-.39,.34]:g.box([x-.027,.025,z-.027],[x+.027,.711,z+.027],metal);g.box([x-.03,.006,z-.03],[x+.03,.026,z+.03],black)
counts={'table':g.emit('inferred_table_complete')}
g=Geometry();floor_mat=material('inferred_floor',[1,1,1],texture=texture((out/'floor-sample.png').read_bytes(),'image/png','calibrated_public_carpet_sample'),unlit=True)
floor_v=np.array([[-1.30,.012,-1.02],[1.46,.012,-1.02],[1.46,.012,1.02],[-1.30,.012,1.02]])
# A narrow ring meets the actual clipped floor boundary heights; no open step at the edge.
floor_points=[]
for p in builder.doc['meshes'][0]['primitives']:
 vv=accessor(builder.doc,builder.binary,p['attributes']['POSITION']);ff=accessor(builder.doc,builder.binary,p['indices']);floor_points.extend(vv[np.unique(ff)][(vv[np.unique(ff)][:,1]>-.05)&(vv[np.unique(ff)][:,1]<.075)])
floor_points=np.array(floor_points);inner=floor_v.copy();inner[:,0]+=[.065,-.065,-.065,.065];inner[:,2]+=[.065,.065,-.065,-.065]
g.add(inner,[[0,2,1],[0,3,2]],floor_mat,(inner[:,[0,2]]-[-1.30,-1.02])/.38)
for axis,bound,other,a,b in [(0,-1.30,2,-1.02,1.02),(0,1.46,2,-1.02,1.02),(2,-1.02,0,-1.30,1.46),(2,1.02,0,-1.30,1.46)]:
 q=floor_points[(abs(floor_points[:,axis]-bound)<1e-5)&(floor_points[:,other]>=a-1e-5)&(floor_points[:,other]<=b+1e-5)];order=np.argsort(q[:,other]);q=q[order];coords=np.unique(np.r_[a,q[:,other],b]);outer=[]
 for t in coords:
  near=q[abs(q[:,other]-t)<1e-5];y=float(near[:,1].max()) if len(near) else float(np.interp(t,q[:,other],q[:,1])) if len(q) else .012;point=np.zeros(3);point[axis]=bound;point[other]=t;point[1]=y;outer.append(point)
 outer=np.array(outer);inside=outer.copy();inside[:,1]=.012;inside[:,axis]=bound+(.065 if bound<0 else -.065);inside[:,other]=np.clip(inside[:,other],a+.065,b-.065)
 for j in range(len(outer)-1):
  v=np.array([outer[j],outer[j+1],inside[j+1],inside[j]]);g.add(v,[[0,1,2],[0,2,3]],floor_mat,(v[:,[0,2]]-[-1.30,-1.02])/.38)
counts['floor']=g.emit('inferred_floor_patch')
# Five chairs, located from observed back clusters; closed opaque woven panels avoid fake mesh holes.
chair=Geometry();chair.rounded(-.235,.235,-.215,.245,.444,.493,.06,seat)
nx,ny=20,24;v=[];uv=[]
for side in [0,1]:
 for j in range(ny+1):
  h=j/ny
  for i in range(nx+1):
   x=(i/nx-.5)*.465;v.append([x,.545+.565*h,-.175-.080*h+.025*(x/.2325)**2+side*.009]);uv.append([i/nx,j/ny])
layer=(nx+1)*(ny+1);f=[]
for j in range(ny):
 for i in range(nx):
  a=j*(nx+1)+i;b=a+1;c=b+nx+1;d=a+nx+1;f.extend([[a,c,b],[a,d,c],[a+layer,b+layer,c+layer],[a+layer,c+layer,d+layer]])
border=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
for i,a in enumerate(border):b=border[(i+1)%len(border)];f.extend([[a,b,a+layer],[b,b+layer,a+layer]])
chair.add(v,f,meshmat,uv)
for edge_indices in [[j*(nx+1) for j in range(ny+1)],[j*(nx+1)+nx for j in range(ny+1)],list(range(ny*(nx+1),(ny+1)*(nx+1))),list(range(nx+1))]:
 for a,b in zip(edge_indices,edge_indices[1:]):chair.tube(v[a],v[b],.012,black,10)
for x in [-.20,.20]:chair.tube([x,.465,-.14],[x,.66,-.19],.017,black)
chair.tube([0,.115,0],[0,.444,0],.024,metal);chair.tube([0,.13,0],[0,.28,0],.037,black)
for t in np.arange(5)*2*np.pi/5:
 end=np.array([np.cos(t)*.29,.072,np.sin(t)*.29]);chair.tube([0,.155,0],end,.019,black);chair.tube(end+[-.025,-.028,0],end+[.025,-.028,0],.040,black,20)
centers=[(-.45,-.505,0),(-.41,.485,np.pi),(.172,-.505,0),(.272,.485,np.pi),( .850,.044,-np.pi/2)]
for i,(x,z,a) in enumerate(centers):
 R=np.array([[np.cos(a),0,np.sin(a)],[0,1,0],[-np.sin(a),0,np.cos(a)]]);counts['chair_'+str(i+1)]=chair.emit('inferred_chair_'+str(i+1),(R,np.array([x,0,z])))
# Display slabs with original single-view appearance on the front and dark frames.
g=Geometry();wall_mat=material('screen_surround',[.075,.078,.074],unlit=True);g.box([-2.38,1.265,-1.515],[-2.37,2.095,1.405],wall_mat);counts['screen_surround']=g.emit('inferred_screen_surround')
for key in ['screen_left','screen_right']:
 corners=np.array(plan[key]['corners']);lo=corners.min(0);hi=corners.max(0);g=Geometry();outer_z=(-1.51,-.035) if key=='screen_left' else (-.035,1.33);g.box([lo[0]-.145,1.275,outer_z[0]],[hi[0]-.001,2.09,outer_z[1]],black);g.add(corners,[[0,1,2],[0,2,3]],photo_mat(key),projected(corners,key));counts[key]=g.emit('inferred_'+key)
g=Geometry();g.box([-2.35,1.07,-.18],[-2.025,1.09,.14],black);g.box([-2.34,1.085,-.035],[-2.15,1.175,.01],metal);g.tube([-2.10,1.205,-.13],[-2.10,1.205,.09],.040,cream,24);g.tube([-2.09,1.205,-.02],[-2.05,1.205,-.02],.025,black,24);g.tube([-2.05,1.205,-.02],[-2.047,1.205,-.02],.017,blue,24);counts['conference_camera']=g.emit('inferred_conference_camera')
# Color checker folding stand: original public photo appearance, approximate fold geometry.
g=Geometry();p=np.array(plan['chart']['corners']);back=np.array([[.455,.761,-.172],[.455,.761,.115]])
g.add(np.concatenate([p,back]),[[0,1,2],[0,2,3],[1,4,5],[1,5,2],[0,4,1],[3,2,5],[0,3,5],[0,5,4]],black)
p[:,1]+=.0008;g.add(p,[[0,1,2],[0,2,3]],photo_mat('chart'),projected(p,'chart'));counts['chart']=g.emit('inferred_color_chart')
# Pen organizer with open compartments and individual pens, replacing the collapsed fragments.
g=Geometry();g.rounded(-.089,.023,-.158,.088,.759,.772,.01,black)
for z0,z1 in [(-.158,-.074),(-.071,.004),(.007,.088)]:
 for lo,hi in [([-.089,.772,z0],[.023,.826,z0+.004]),([-.089,.772,z1-.004],[.023,.826,z1]),([-.089,.772,z0],[-.085,.826,z1]),([.019,.772,z0],[.023,.826,z1])]:g.box(lo,hi,black)
 for j in range(6):g.box([-.090,.775,z0+(z1-z0)*j/6],[-.089,.821,z0+(z1-z0)*j/6+.001],silver)
rng=np.random.default_rng(42)
for i in range(24):
 x=rng.uniform(-.073,.007);z=rng.uniform(-.145,.075);h=rng.uniform(.10,.155);a=[x,.774,z];b=[x+rng.uniform(-.013,.013),.774+h,z+rng.uniform(-.009,.009)];m=[blue,red,green,black,cream][i%5];g.tube(a,b,.004,m,10);g.tube(np.array(b)-[0,.015,0],np.array(b)+[0,.007,0],.0048,m,10)
counts['organizer']=g.emit('inferred_pen_organizer')
# Cylinder photo is a fixed projection, not recovered view-dependent material.
g=Geometry();n=64;v=[]
for y in [.759,.965]:v.extend([[-.524+.053*np.cos(t),y,-.026+.053*np.sin(t)] for t in np.arange(n)*2*np.pi/n])
f=[]
for i in range(n):j=(i+1)%n;f.extend([[i,n+j,j],[i,n+i,n+j]])
g.add(v,f,photo_mat('can'),projected(v,'can'));g.tube([-.524,.958,-.026],[-.524,.973,-.026],.056,cream,48);g.tube([-.524,.759,-.026],[-.524,.763,-.026],.054,cream,48);g.tube([-.524,.973,-.026],[-.524,.975,-.026],.044,white,48);counts['can']=g.emit('inferred_wipes_can')
# Pencil cup: closed bottom, open inner wall and individual pencils.
g=Geometry();cx,cz=-.92,-.018;n=40;v=[]
for y,r in [(.76,.046),(.875,.056),(.875,.050),(.769,.040)]:v.extend([[cx+r*np.cos(t),y,cz+r*np.sin(t)] for t in np.arange(n)*2*np.pi/n])
f=[]
for ring in range(3):
 for i in range(n):j=(i+1)%n;a=ring*n+i;b=ring*n+j;f.extend([[a,b,b+n],[a,b+n,a+n]])
g.add(v,f,cream);g.tube([cx,.761,cz],[cx,.769,cz],.042,cream,40)
for i in range(14):
 t=i*2.399;x=cx+.025*np.cos(t);z=cz+.025*np.sin(t);end=np.array([x+.028*np.cos(t),.965+rng.uniform(-.02,.02),z+.028*np.sin(t)]);g.tube([x,.787,z],end,.0025,[wood,red,blue,green][i%4],8);g.tube(end,end+[0,.007,0],.0012,black,8)
counts['cup']=g.emit('inferred_pencil_cup')
target=out/'office-room-final.glb';builder.save(target);overlay.save(out/'room-repair-overlay-final.glb')
for p in [target,out/'room-repair-overlay-final.glb']:shutil.copy2(p,root/'viewer/assets'/p.name)
for key in plan:shutil.copy2(root/'source/images'/plan[key]['view']['image'],root/'viewer/assets'/plan[key]['view']['image'])
report={'source':'../door-v01/office-door-repaired.glb','output':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'clip_regions':regions,'clipping':records,'generated_triangle_counts':counts,'chairs_observed':5,'original_image_bytes_preserved':True,'provenance':'Hybrid reconstruction plus procedural replacement; furniture dimensions approximate, no recovered-material or measurement claim','remaining_limits':['Original wall/ceiling/floor texture seams and surface waviness','Fixed photo appearance on glass, displays and can','No certified collision, global watertightness or measured dimensions']}
(out/'room-repair-report-final.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
