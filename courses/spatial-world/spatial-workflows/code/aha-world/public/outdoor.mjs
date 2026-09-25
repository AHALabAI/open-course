import * as THREE from 'three';
import {OUTDOOR_RECTS,TREES,BENCHES} from './outdoor-layout.mjs';
export function createOutdoor(){
 const group=new THREE.Group();group.name='AHA_Outdoor_Extension';
 const surfaces=[],material=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 const grass=material('#91ad79'),soil=material('#9a8060'),path=material('#d9c9a5'),wood=material('#987049'),leaf=material('#658b62'),leafLight=material('#86a36c'),dark=material('#405d50');
 const box=(w,h,d,m,x,y,z,parent=group)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 for(const [x0,z0,x1,z1] of OUTDOOR_RECTS){box(x1-x0,.6,z1-z0,soil,(x0+x1)/2,-.38,(z0+z1)/2);const ground=box(x1-x0,.12,z1-z0,grass,(x0+x1)/2,-.1,(z0+z1)/2);surfaces.push(ground);}
 // Offset paths above grass, with no coplanar faces that could shimmer.
 for(const [x,z,w,d] of [[3,15,34,2],[3,12.7,2,4.6],[19,2,2,28],[-15,2,2,28],[2,-10,34,2]])surfaces.push(box(w,.045,d,path,x,-.011,z));
 const trunkGeometry=new THREE.CylinderGeometry(.18,.25,1.8,6),crownGeometry=new THREE.IcosahedronGeometry(1.35,0);
 const trunks=new THREE.InstancedMesh(trunkGeometry,wood,TREES.length),crowns=new THREE.InstancedMesh(crownGeometry,leaf,TREES.length),tops=new THREE.InstancedMesh(crownGeometry,leafLight,TREES.length);
 const transform=new THREE.Object3D();
 TREES.forEach(([x,z],i)=>{transform.position.set(x,.85,z);transform.scale.set(1,1,1);transform.rotation.y=i*.73;transform.updateMatrix();trunks.setMatrixAt(i,transform.matrix);transform.position.y=2.6;transform.scale.set(1,.95,1);transform.updateMatrix();crowns.setMatrixAt(i,transform.matrix);transform.position.set(x+.3,3.25,z-.2);transform.scale.set(.7,.72,.7);transform.updateMatrix();tops.setMatrixAt(i,transform.matrix);});
 group.add(trunks,crowns,tops);
 for(const b of BENCHES){const bench=new THREE.Group();bench.position.set(b.x,0,b.z);bench.rotation.y=b.angle;group.add(bench);for(const z of [-.25,0,.25])box(2.6,.10,.19,wood,0,.48,z,bench);for(const x of [-1,1])box(.14,.48,.55,dark,x,.22,0,bench);box(2.6,.55,.12,wood,0,.94,-.35,bench);}
 // Picnic table and a small flower garden on the new lawn.
 box(2.1,.12,1.25,wood,-10,.76,16.5);for(const x of [-10.75,-9.25])box(.12,.72,.9,dark,x,.34,16.5);
 const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.13,0),material('#e8b56c'),64);
 for(let i=0;i<64;i++){const x=-7+(i%16)*.3,z=18.6+Math.floor(i/16)*.28;transform.position.set(x,.16,z);transform.scale.set(1,1,1);transform.updateMatrix();flowers.setMatrixAt(i,transform.matrix);}group.add(flowers);
 // Low boundary posts signal the playable edge without enclosing the original courtyard.
 for(let x=-21;x<=23;x+=2.2)for(const z of [-15.5,23.5])box(.12,.7,.12,wood,x,.3,z);
 for(let z=-13;z<=22;z+=2.2)for(const x of [-21.5,23.5])box(.12,.7,.12,wood,x,.3,z);
 const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128;const ctx=signCanvas.getContext('2d');ctx.fillStyle='#315b46';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff3d1';ctx.font='bold 40px sans-serif';ctx.textAlign='center';ctx.fillText('AHA · 林间花园',256,58);ctx.font='24px sans-serif';ctx.fillText('散步 · 采集 · 自由创作',256,100);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCanvas),side:THREE.DoubleSide}));sign.position.set(-1,1.5,13.6);group.add(sign);box(.12,1.6,.12,wood,-1,.7,13.6);
 return {group,surfaces};
}
