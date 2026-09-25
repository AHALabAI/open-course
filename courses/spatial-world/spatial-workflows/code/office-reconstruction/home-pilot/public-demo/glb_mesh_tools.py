"""Small GLB reader/builder for local uncompressed reconstruction meshes."""
import json,struct,copy
from pathlib import Path
import numpy as np
def read_glb(path):
 raw=Path(path).read_bytes();assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
 size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);return doc,raw[28+size:]
def accessor(doc,binary,index):
 a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
 assert view['buffer']==0 and not view.get('byteStride')
 dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 x=np.frombuffer(binary,dtype=dtype,count=a['count']*width,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).copy()
 return x.reshape(-1,width) if width>1 else x
class Builder:
 def __init__(self,doc=None):
  self.doc=copy.deepcopy(doc) if doc else {'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[]}
  self.doc['bufferViews']=[];self.doc['accessors']=[];self.binary=bytearray()
 def blob(self,data):
  self.binary.extend(b'\0'*(-len(self.binary)%4));index=len(self.doc['bufferViews']);self.doc['bufferViews'].append({'buffer':0,'byteOffset':len(self.binary),'byteLength':len(data)});self.binary.extend(data);return index
 def array(self,x,typ):
  x=np.asarray(x,dtype='<u4' if typ=='SCALAR' else '<f4');view=self.blob(x.tobytes());a={'bufferView':view,'componentType':5125 if typ=='SCALAR' else 5126,'type':typ,'count':len(x)}
  if typ=='VEC3':a.update(min=x.min(0).tolist(),max=x.max(0).tolist())
  i=len(self.doc['accessors']);self.doc['accessors'].append(a);return i
 def primitive(self,positions,faces,material,uv=None):
  p={'attributes':{'POSITION':self.array(positions,'VEC3')},'indices':self.array(np.asarray(faces).reshape(-1),'SCALAR'),'material':material}
  if uv is not None:p['attributes']['TEXCOORD_0']=self.array(uv,'VEC2')
  return p
 def node(self,primitives,name,extras=None):
  m=len(self.doc['meshes']);self.doc['meshes'].append({'primitives':primitives});n=len(self.doc['nodes']);self.doc['nodes'].append({'mesh':m,'name':name,**({'extras':extras} if extras else {})});self.doc['scenes'][0]['nodes'].append(n)
 def save(self,path):
  self.doc['buffers']=[{'byteLength':len(self.binary)}];self.binary.extend(b'\0'*(-len(self.binary)%4));j=json.dumps(self.doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
  with Path(path).open('xb') as f:f.write(struct.pack('<4sII',b'glTF',2,28+len(j)+len(self.binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(self.binary),0x004E4942)+self.binary)
