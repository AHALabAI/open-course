import * as THREE from 'three';
import {GLTFLoader} from '/vendor/GLTFLoader.js';
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce7d5');
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);
camera.position.set(12,14,18);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;$('world').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x73886d,2.3));
const sun=new THREE.DirectionalLight(0xfff4d5,3);sun.position.set(4,12,8);sun.castShadow=true;sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const makeActor=(color)=>{const g=new THREE.Group();const m=new THREE.MeshStandardMaterial({color});const body=new THREE.Mesh(new THREE.CapsuleGeometry(.19,.35,4,8),m);body.position.y=.4;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),m);head.position.y=.82;g.add(head);scene.add(g);return g;};
sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;
const player=makeActor('#d38c2e');player.position.set(0,0,1.5);
const npc=makeActor('#2b7760');npc.position.set(.9,0,3.4);
const state={health:80,wood:0,fire:false};const history=[];let paused=false,ready=false,busy=false,npcAction='guard',collected=new Set(),meshes=[],woodItems=[],fire;
let target=null;const keys=new Set();const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();
const blockers=[{x:-2,z:-2.8,w:2.8,d:.9},{x:1.8,z:-2.4,w:1.9,d:1.3}];
function canWalk(v){return v.x>=-3.65&&v.x<=6&&v.z>=-3.65&&v.z<=5.5&&!blockers.some(b=>Math.abs(v.x-b.x)<b.w/2+.22&&Math.abs(v.z-b.z)<b.d/2+.22);}
function update(){ $('inventory').textContent=`木头 ${state.wood} / 3 · ${state.fire?'火堆已点燃':'火堆未点燃'}`;$('portal').disabled=!state.fire||paused; }
function interact(obj){
 if(paused||!ready)return;
 if(!obj){const candidates=[...woodItems.filter(x=>!collected.has(x.uuid)),fire];obj=candidates.sort((a,b)=>player.position.distanceTo(a.getWorldPosition(new THREE.Vector3()))-player.position.distanceTo(b.getWorldPosition(new THREE.Vector3())))[0];}
 if(!obj)return;const pos=obj.getWorldPosition(new THREE.Vector3());pos.y=0;
 if(player.position.distanceTo(pos)>1.5){target=pos;$('hint').textContent='先走近，再点击一次或按 E。';return;}
 if(obj.userData.kind==='wood'&&!collected.has(obj.uuid)){collected.add(obj.uuid);obj.visible=false;state.wood++;$('hint').textContent=state.wood===3?'材料够了，去火堆旁点燃。':'收集成功，继续寻找金色木块。';}
 if(obj.userData.kind==='fire'){
  if(state.fire){$('hint').textContent='火堆已点燃，小游戏入口已开启。';}
  else if(state.wood<3){$('hint').textContent='点火需要三块木头。';}
  else{state.wood-=3;state.fire=true;const flame=new THREE.Mesh(new THREE.ConeGeometry(.35,.9,7),new THREE.MeshStandardMaterial({color:0xffb438,emissive:0xee6414,emissiveIntensity:2}));flame.position.copy(pos);flame.position.y=.7;scene.add(flame);$('hint').textContent='完成！现在可以进入小游戏。';}
 }
 update();
}
try{
 const gltf=await new GLTFLoader().loadAsync('/assets/room.glb');scene.add(gltf.scene);
 gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;meshes.push(o);if(o.userData.kind==='wood')woodItems.push(o);if(o.userData.kind==='fire')fire=o;}});
 if(woodItems.length!==3||!fire)throw Error('模型缺少交互标记');ready=true;$('status').textContent='Blender GLB 已载入 · 点击地面开始探索';
}catch(e){$('status').textContent='载入失败：先运行 build_scene.py，检查 /assets/room.glb。';console.error(e);}
renderer.domElement.addEventListener('pointerup',e=>{
 if(paused||!ready)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);
 const hit=ray.intersectObjects(meshes.filter(o=>o.visible))[0];if(!hit)return;
 if(['wood','fire'].includes(hit.object.userData.kind))interact(hit.object);
 else if(['ground','floor'].includes(hit.object.userData.kind)){const p=hit.point.clone();p.y=0;if(canWalk(p))target=p;}
});
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','BUTTON','SUMMARY'].includes(document.activeElement.tagName))return;if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e'].includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e'&&!e.repeat)interact();}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
$('interact').onclick=()=>interact();$('health').oninput=e=>{state.health=Number(e.target.value);$('health-value').textContent=state.health;};
function pause(on){paused=on;target=null;keys.clear();$('resume').hidden=!on;update();$('status').textContent=on?'本场景已暂停；关闭小游戏后点击“返回，继续探索”。':'继续探索 · 游戏状态已保留';}
$('portal').onclick=()=>{if(!state.fire||paused)return;const a=document.createElement('a');a.href='/mini-game.html';a.target='_blank';a.rel='noopener noreferrer';a.click();pause(true);};$('resume').onclick=()=>pause(false);
async function api(route,body){const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(r.status===429?'请稍候重试；本次启动最多40次请求。':'请求未成功，请检查输入与服务端。');return r.json();}
$('decide').onclick=async()=>{if(busy||paused)return;busy=true;$('decide').disabled=true;$('decision').textContent='正在判断…';try{const r=await api('/api/decision',{state});npcAction=r.action;$('decision').textContent=`${r.reason} · ${r.action}${r.confidence===null?'':` · 置信度 ${r.confidence.toFixed(2)}`}`;}catch(e){$('decision').textContent=e.message;}finally{busy=false;$('decide').disabled=false;}};
$('chat-form').onsubmit=async e=>{e.preventDefault();if(busy||paused)return;busy=true;const question=$('question').value.trim();$('answer').textContent='正在获取提示…';try{const r=await api('/api/chat',{state,question,history});$('answer').textContent=`${r.reason}：${r.text}`;history.push({role:'user',content:question},{role:'assistant',content:r.text});history.splice(0,Math.max(0,history.length-6));}catch(err){$('answer').textContent=err.message;}finally{busy=false;}};
function move(actor,dest,dt,speed=2){const dir=dest.clone().sub(actor.position);dir.y=0;const length=dir.length();if(length<.08)return;dir.normalize();const next=actor.position.clone().addScaledVector(dir,Math.min(length,speed*dt));if(canWalk(next))actor.position.copy(next);actor.rotation.y=Math.atan2(dir.x,dir.z);}
let prev=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-prev)/1000,.05);prev=now;if(!paused&&!document.hidden&&ready){const v=new THREE.Vector3((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),0,(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0));if(v.lengthSq()){target=null;move(player,player.position.clone().add(v.normalize()),dt,2.8);}else if(target)move(player,target,dt,2.8);const remaining=woodItems.filter(x=>!collected.has(x.uuid));let dest=new THREE.Vector3(.9,0,3.4);if(npcAction==='assist')dest=player.position.clone().add(new THREE.Vector3(.5,0,.5));if(npcAction==='gather'&&remaining.length)dest=remaining[0].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.6,0,.5));move(npc,dest,dt,1.2);}renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
if(innerWidth<700)document.querySelector('details').open=false;
// Read-only snapshot for the tutorial's browser checks; never exposes keys.
window.tutorialSnapshot=()=>({ready,state:{...state},paused,position:player.position.toArray(),woodCount:woodItems.length,collected:collected.size,npcAction});
window.tutorialScreenPoint=name=>{const o=meshes.find(m=>m.name===name);if(!o)return null;const p=o.getWorldPosition(new THREE.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};};
