from pathlib import Path
import json,struct,shutil
import numpy as np
from analyze_holes import read_mesh
root=Path(__file__).resolve().parent;out=root/'repairs/table-v01'
doc={'asset':{'version':'2.0','generator':'AHA Lab inferred surfaces'},'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':[],'meshes':[],'bufferViews':[],'accessors':[],'materials':[{'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1,.35,.04,1]},'extensions':{'KHR_materials_unlit':{}}}],'extensionsUsed':['KHR_materials_unlit']}
binary=bytearray()
def add_mesh(vertices,faces,name):
 ids,inverse=np.unique(faces,return_inverse=True);v=vertices[ids].astype('<f4');indices=inverse.reshape(-1).astype('<u4')
 accessors=[]
 for array,typ,target in [(v,'VEC3',34962),(indices,'SCALAR',34963)]:
  data=array.tobytes();view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data),'target':target});binary.extend(data)
  accessor={'bufferView':view,'componentType':5126 if typ=='VEC3' else 5125,'count':len(array),'type':typ}
  if typ=='VEC3':accessor.update(min=v.min(0).tolist(),max=v.max(0).tolist())
  accessors.append(len(doc['accessors']));doc['accessors'].append(accessor)
 index=len(doc['meshes']);doc['meshes'].append({'primitives':[{'attributes':{'POSITION':accessors[0]},'indices':accessors[1],'material':0}]});doc['nodes'].append({'name':name,'mesh':index})
v,f=read_mesh(root/'repairs/planar-v01/scene_patched.ply');add_mesh(v,f[427273:],'inferred_walls')
v,f=read_mesh(out/'tabletop-inferred.ply');add_mesh(v,f,'inferred_tabletop')
doc['buffers']=[{'byteLength':len(binary)}];j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
target=out/'table-repair-overlay.glb'
with target.open('xb') as file:file.write(struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(binary),0x004E4942)+binary)
shutil.copy2(target,root/'viewer/assets'/target.name)
print('Wall and table inference overlay exported.')
