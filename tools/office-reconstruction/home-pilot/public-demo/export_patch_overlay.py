"""Export only inferred surfaces so the viewer can disclose them explicitly."""
from pathlib import Path
import json,struct,shutil
import numpy as np
from analyze_holes import read_mesh
root=Path(__file__).resolve().parent;out=root/'repairs/planar-v01'
v,f=read_mesh(out/'scene_patched.ply');report=json.loads((out/'repair-report.json').read_text())
patch=f[report['original_triangles']:];ids,indices=np.unique(patch,return_inverse=True)
positions=v[ids].astype('<f4');indices=indices.reshape(-1).astype('<u4')
assert len(indices)==len(patch)*3
pos=positions.tobytes();ind=indices.tobytes();binary=pos+ind
doc={'asset':{'version':'2.0','generator':'AHA Lab inferred planar patch overlay'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],
 'buffers':[{'byteLength':len(binary)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(pos),'target':34962},{'buffer':0,'byteOffset':len(pos),'byteLength':len(ind),'target':34963}],
 'accessors':[{'bufferView':0,'componentType':5126,'count':len(positions),'type':'VEC3','min':positions.min(0).tolist(),'max':positions.max(0).tolist()},{'bufferView':1,'componentType':5125,'count':len(indices),'type':'SCALAR'}],
 'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1,'material':0}]}],
 'materials':[{'name':'inferred_not_measured','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1,.35,.04,1]},'extensions':{'KHR_materials_unlit':{}}}],
 'extensionsUsed':['KHR_materials_unlit'],'extras':{'provenance':'Added planar completion, not directly observed geometry'}}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
target=out/'repair-overlay.glb'
with target.open('xb') as file:file.write(struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(binary),0x004E4942)+binary)
shutil.copy2(target,root/'viewer/assets'/target.name)
print('Inferred surface overlay exported:',len(patch),'triangles')
