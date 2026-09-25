import {NPC_REPLIES} from './npc-replies.mjs';
import {createExamplePortals} from './example-portals.mjs';
import {createFishingQuest} from './portal-quest.mjs';
import {createGameAudio} from './audio.mjs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {createOutdoor} from './outdoor.mjs';
import {OUTDOOR_RESOURCES} from './outdoor-layout.mjs';
import {RULES,CHARACTER_SCALE,FLOOR_NAMES,newGame,pay,tickState,localDecision} from './rules.mjs';
import {FLOOR_HEIGHT,LANDINGS,EXTERIOR_STAIRS,BEACON,WATER,setNavigation,sourceBlocked,nearestWalkable} from './navigation.mjs';
const blocked=(x,z,f,_colliders,blocks=[])=>sourceBlocked(x,z,f,blocks);

const $=id=>document.getElementById(id);
const canvas=$('world');
const fullscreenButton=document.createElement('button');fullscreenButton.id='fullscreen';fullscreenButton.textContent='全屏';document.querySelector('.topright').append(fullscreenButton);
const landscapeButton=document.createElement('button');landscapeButton.id='landscape';landscapeButton.textContent='横屏';document.querySelector('.topright').append(landscapeButton);
fullscreenButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('此浏览器不支持网页全屏，可使用浏览器菜单或添加到主屏幕。');}catch{toast('浏览器未允许全屏，请使用浏览器菜单。');}};
document.addEventListener('fullscreenchange',()=>{fullscreenButton.textContent=document.fullscreenElement?'退出全屏':'全屏';});
landscapeButton.onclick=async()=>{try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();if(!screen.orientation?.lock)throw Error('unsupported');await screen.orientation.lock('landscape');}catch{toast('请将手机或平板横向旋转，并关闭系统的方向锁定。');}};
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});}
catch{$('loadstatus').textContent='此浏览器无法启动 3D，请启用硬件加速后刷新。';throw Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce9df');scene.fog=new THREE.Fog('#dce9df',70,140);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,200);
const groundSurfaces=[[],[],[],[]],groundCache=new Map(),groundRay=new THREE.Raycaster();
const occluders=[],faded=new Set(),occlusionRay=new THREE.Raycaster();let lastOcclusion=0;
function updateOcclusion(now){
  if(now-lastOcclusion<180)return;lastOcclusion=now;
  const next=new Set();
  if(mode!=='intro'&&!overview){const aim=playerMesh.position.clone().add(new THREE.Vector3(0,CHARACTER_SCALE,0)),direction=aim.clone().sub(camera.position);occlusionRay.set(camera.position,direction.clone().normalize());occlusionRay.far=Math.max(0,direction.length()-.3);for(const h of occlusionRay.intersectObjects(occluders,false))if(h.object.userData.floor===player.floor)next.add(h.object);}
  for(const o of faded)if(!next.has(o)){o.material=o.userData.solidMaterial;faded.delete(o);}
  for(const o of next)if(!faded.has(o)){o.userData.solidMaterial??=o.material;if(!o.userData.fadeMaterial){const fade=m=>{const copy=m.clone();copy.transparent=true;copy.opacity=.18;copy.depthWrite=false;return copy;};o.userData.fadeMaterial=Array.isArray(o.material)?o.material.map(fade):fade(o.material);}o.material=o.userData.fadeMaterial;faded.add(o);}
}
function groundY(x,z,f){
  if(!groundSurfaces[f]?.length)return f*FLOOR_HEIGHT;
  const key=`${f}:${Math.round(x*20)}:${Math.round(z*20)}`;
  if(groundCache.has(key))return groundCache.get(key);
  groundRay.set(new THREE.Vector3(x,f*FLOOR_HEIGHT+.7,z),new THREE.Vector3(0,-1,0));groundRay.far=1.2;
  const hit=groundRay.intersectObjects(groundSurfaces[f],false).find(h=>Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).y)>.8);
  const y=hit?hit.point.y:f*FLOOR_HEIGHT;if(groundCache.size>6000)groundCache.clear();groundCache.set(key,y);return y;
}
const hemi=new THREE.HemisphereLight('#edf9e8','#7b8a68',2.3);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d1',3);sun.position.set(-15,28,15);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:90});sun.shadow.bias=-.0005;sun.shadow.normalBias=.035;scene.add(sun);
const waterGround=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#b4d6cb',roughness:1}));waterGround.rotation.x=-Math.PI/2;waterGround.position.y=-2;waterGround.receiveShadow=true;scene.add(waterGround);
const dynamic=new THREE.Group();scene.add(dynamic);
const mat=(color,emissive)=>new THREE.MeshStandardMaterial({color,roughness:.8,...(emissive?{emissive:color,emissiveIntensity:emissive}:{})});
const palette={wood:mat('#b47c41'),stone:mat('#899f99'),crystal:mat('#5fffd7',.45),food:mat('#edab56'),teal:mat('#287c73'),gold:mat('#e9b34a'),white:mat('#fff1d2'),dark:mat('#203d40')};
function cube(w,h,d,material,parent=dynamic,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function marker(x,z,f,color='#8ad7b9',r=.7){const m=new THREE.Mesh(new THREE.RingGeometry(r-.07,r,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.9}));m.rotation.x=-Math.PI/2;m.position.set(x,groundY(x,z,f)+.09,z);m.userData.floor=f;dynamic.add(m);return m;}
function character(color){
  const g=new THREE.Group();g.scale.setScalar(CHARACTER_SCALE);const body=mat(color);
  cube(.48,.62,.30,body,g,0,.78,0);cube(.4,.38,.37,palette.white,g,0,1.29,0);
  cube(.46,.15,.4,body,g,0,1.51,0);cube(.05,.055,.03,palette.dark,g,-.09,1.3,.20);cube(.05,.055,.03,palette.dark,g,.09,1.3,.20);
  const legs=[cube(.17,.40,.19,palette.dark,g,-.14,.22,0),cube(.17,.40,.19,palette.dark,g,.14,.22,0)];
  const arms=[cube(.15,.52,.18,body,g,-.34,.8,0),cube(.15,.52,.18,body,g,.34,.8,0)];
  cube(.36,.42,.19,palette.wood,g,0,.83,-.23);g.userData.limbs=[...legs,...arms];scene.add(g);return g;
}
const playerMesh=character('#eab04e'),npcMesh=character('#5aa8a0');
playerMesh.visible=npcMesh.visible=false;
let player={x:0,z:8.8,floor:0},npc={x:3,z:9,action:'guard',cooldown:0};
const dialogueSession=crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
const audio=createGameAudio();
const state=newGame();let mode='intro',paused=false,overview=true,buildMode=false,aiEnabled=true,ready=false,world;
let colliders=[],blocks=[],resources=[],floorGroups=[];
let orbit=.64,elevation=.65,distance=66;
const target=new THREE.Vector3(0,4,0),cameraTarget=new THREE.Vector3();
let toastTimer=0,aiDue=0,aiPending=false,epoch=0,roundCalls=0,aiGeneration=0,keys={};
let selectedBlock='wood',lastDecision=null,lastTime=performance.now(),animationTime=0;
const fishingQuest=createFishingQuest({scene,player,active,groundY,audio,toast,setPaused(value){paused=value;keys={};$('pause').textContent=value?'继续':'暂停';updateHUD();}});
const examplePortals=createExamplePortals({scene,player,state,active,groundY,audio,toast,setPaused(value){paused=value;keys={};$('pause').textContent=value?'继续':'暂停';updateHUD();}});
const infoDrawer=document.createElement('section');infoDrawer.id='infoDrawer';$('hud').append(infoDrawer);
infoDrawer.append(document.querySelector('.quests'),document.querySelector('.brain'));
const statusButton=document.createElement('button');statusButton.textContent='状态 / 楼层';statusButton.id='touchStatus';document.querySelector('.touchmenu').prepend(statusButton);
statusButton.onclick=()=>document.body.classList.toggle('show-status');
const notice=document.createElement('button');notice.id='mentionNotice';notice.hidden=true;notice.setAttribute('aria-live','polite');document.body.append(notice);
let unread=0,roomPlayers=[],lastStatus=0;
function openChat(){document.body.classList.add('show-room');unread=0;$('touchRoom').textContent='聊天';notice.hidden=true;}
notice.onclick=openChat;
$('roompanel').insertAdjacentHTML('afterbegin','<div class="chatheading"><span>房间消息</span><button id="closeRoom" aria-label="收起聊天">收起 ×</button></div>');
$('closeRoom').onclick=()=>document.body.classList.remove('show-room');
const mentions=document.createElement('select');mentions.id='mentionSelect';mentions.setAttribute('aria-label','选择要提及的角色');
$('roomchat').before(mentions);mentions.onchange=()=>{if(mentions.value){$('roominput').value+=`${$('roominput').value?' ':''}@${mentions.value} `;$('roominput').focus();mentions.value='';}};
function updateMentions(){const value=mentions.value;mentions.replaceChildren(new Option('@ 选择角色',''),new Option('AHA · AI 问答','AHA'));for(const p of roomPlayers)if(p.id!==myId)mentions.add(new Option(p.name,p.name));mentions.value=value;}
const resizeHandle=document.createElement('button');resizeHandle.id='chatResize';resizeHandle.textContent='↙ 调整大小';resizeHandle.setAttribute('aria-label','拖动调整聊天框大小');$('roompanel').append(resizeHandle);
let resizing=null;resizeHandle.onpointerdown=e=>{const r=$('roompanel').getBoundingClientRect();resizing={x:e.clientX,y:e.clientY,w:r.width,h:r.height};resizeHandle.setPointerCapture(e.pointerId);};
resizeHandle.onpointermove=e=>{if(!resizing)return;const panel=$('roompanel');panel.style.width=`${Math.max(240,Math.min(innerWidth-20,resizing.w+resizing.x-e.clientX))}px`;panel.style.height=`${Math.max(240,Math.min(innerHeight-160,resizing.h+e.clientY-resizing.y))}px`;};
resizeHandle.onpointerup=resizeHandle.onpointercancel=()=>resizing=null;
let touchReclaim=false;
$('touchActions').onclick=()=>document.body.classList.toggle('show-actions');
$('touchInfo').onclick=()=>document.body.classList.toggle('show-info');
$('touchRoom').onclick=()=>{if(document.body.classList.contains('show-room'))document.body.classList.remove('show-room');else openChat();};
$('touchEat').onclick=()=>{if(active())eat();};
$('touchDrink').onclick=()=>{if(active())drink();};
$('touchZoomIn').onclick=()=>{overview=false;distance=Math.max(12,distance-4);};
$('touchZoomOut').onclick=()=>{overview=false;distance=Math.min(65,distance+4);};
$('touchReclaim').onclick=()=>{touchReclaim=!touchReclaim;$('touchReclaim').textContent=`回收：${touchReclaim?'开':'关'}`;$('touchReclaim').setAttribute('aria-pressed',String(touchReclaim));};
document.querySelectorAll('.slot').forEach((slot,i)=>{if(i<2){slot.onclick=()=>{selectedBlock=i===0?'wood':'stone';toast(`已选择${i===0?'木材':'石块'}`);};}});
let socket=null,myId=null,hostId=null,lastNet=0,serverRevision=-1;const peers=new Map(),sharedBlocks=new Map();
const sendNet=m=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(m));};
for(const [value,label] of [['cat','三花小猫'],['tiger','威风小虎'],['monkey','机灵小猴'],['robot','星际机甲']])$('avatar').add(new Option(label,value));
const avatarMaterials=new Map();
function avatarMat(color){if(!avatarMaterials.has(color))avatarMaterials.set(color,mat(color));return avatarMaterials.get(color);}
function resourceId(r){return `${r.floor}:${r.type}:${r.x}:${r.z}`;}
function animal(mesh,type){
  for(const part of [...mesh.children]){if(part.userData.avatarPart){mesh.remove(part);part.geometry.dispose();}else if(part.isMesh){part.userData.baseMaterial??=part.material;part.material=part.userData.baseMaterial;}}
  if(type==='human')return;
  const color=avatarMat(({fox:'#d78c4a',rabbit:'#f4ede0',cat:'#fff4df',tiger:'#efa433',monkey:'#956540',robot:'#8faeb8'})[type]||'#f4ede0');
  mesh.children.filter(o=>o.isMesh&&o!==sword).forEach(o=>{if(o.material!==palette.dark&&o.material!==palette.wood)o.material=color;});
  const part=(w,h,d,m,x,y,z)=>{const p=cube(w,h,d,m,mesh,x,y,z);p.userData.avatarPart=true;return p;};
  if(type==='cat'){
    const orange=avatarMat('#dd8b38'),black=avatarMat('#34312f'),pink=avatarMat('#e79b9d'),gold=avatarMat('#cbb658');
    const attach=(geometry,material,x,y,z)=>{const p=new THREE.Mesh(geometry,material);p.position.set(x,y,z);p.castShadow=true;p.userData.avatarPart=true;mesh.add(p);return p;};
    const triangle=(w,h,depth,material,x,y,z)=>{const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();return attach(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),material,x,y,z);};
    // Wide, short feline face; upright triangular ears instead of mouse-like side ears.
    part(.64,.5,.46,color,0,1.35,.02);
    triangle(.23,.31,.15,orange,-.205,1.56,-.03);triangle(.23,.31,.15,black,.205,1.56,-.03);
    triangle(.12,.18,.012,pink,-.205,1.60,.125);triangle(.12,.18,.012,pink,.205,1.60,.125);
    // Asymmetric calico patches wrap over the forehead, cheeks and torso.
    part(.28,.29,.018,orange,-.175,1.45,.259);
    part(.18,.26,.018,black,.225,1.47,.259);
    part(.018,.30,.38,orange,-.329,1.45,.015);
    part(.018,.24,.28,black,.329,1.48,.07);
    part(.26,.018,.39,orange,-.18,1.609,.015);
    part(.18,.018,.26,black,.23,1.609,.08);
    for(const x of [-.145,.145]){
      part(.125,.13,.025,gold,x,1.36,.284);part(.028,.105,.012,black,x,1.36,.305);
      part(.025,.025,.01,palette.white,x-.025,1.40,.315);
      part(.17,.095,.045,color,x*.43,1.225,.285);
      for(const dy of [-.035,.035]){const whisker=part(.22,.012,.012,black,Math.sign(x)*.27,1.245+dy,.32);whisker.rotation.z=Math.sign(x)*dy*3;}
    }
    triangle(.085,-.055,.012,pink,0,1.275,.319);
    part(.012,.045,.012,black,0,1.205,.324);
    part(.20,.24,.022,orange,-.13,.92,.166);part(.17,.18,.022,black,.145,.68,.166);
    part(.18,.14,.022,orange,-.34,.67,.108);
    // A furry upward-curled tail, rather than a bare straight rod.
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.48,-.30),new THREE.Vector3(.05,.54,-.68),new THREE.Vector3(.24,.85,-.78),new THREE.Vector3(.20,1.06,-.68)]);
    attach(new THREE.TubeGeometry(curve,16,.085,6,false),orange,0,0,0);
    attach(new THREE.SphereGeometry(.09,8,6),black,.20,1.06,-.68);
    return;
  }
  if(type==='robot'){
    part(.52,.13,.10,palette.dark,0,1.3,.23);for(const x of [-.12,.12])part(.09,.06,.03,palette.crystal,x,1.3,.30);
    part(.04,.25,.04,palette.dark,0,1.75,0);part(.13,.13,.13,palette.gold,0,1.92,0);part(.3,.25,.05,palette.dark,0,.85,.18);part(.12,.08,.06,palette.crystal,0,.88,.22);return;
  }
  for(const x of [-.21,.21]){
    const ear=part(type==='monkey'?.25:.15,type==='rabbit'?.6:type==='monkey'?.25:.3,.14,color,x,type==='monkey'?1.35:1.72,0);ear.rotation.z=x>0?-.18:.18;
    part(.07,type==='rabbit'?.35:.10,.025,avatarMat('#e8b0a0'),x,type==='monkey'?1.35:1.73,.09);
  }
  part(.25,.18,.20,palette.white,0,1.19,.24);part(.08,.06,.035,palette.dark,0,1.25,.36);
  if(type==='cat'||type==='tiger')for(const side of [-1,1])for(const y of [1.16,1.24])part(.20,.015,.02,palette.dark,side*.24,y,.28);
  if(type==='tiger')for(const y of [.62,.8,.98])for(const side of [-1,1])part(.13,.045,.035,palette.dark,side*.18,y,.17);
  if(type==='monkey'){const tail=new THREE.Mesh(new THREE.TorusGeometry(.28,.065,6,12,Math.PI*1.6),color);tail.position.set(0,.6,-.5);tail.userData.avatarPart=true;mesh.add(tail);}
  else{const tail=part(.15,.15,type==='rabbit'?.22:.65,color,0,.5,-.5);tail.rotation.x=.35;}
}
function nameTag(text){const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#173e33dd';ctx.roundRect(8,5,240,54,14);ctx.fill();ctx.fillStyle='#fffbe9';ctx.font='26px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,42);const texture=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));s.scale.set(2.4,.6,1);s.position.y=2.3;return s;}
$('joinroom').onclick=async()=>{if(!ready)return;$('login').showModal();try{const s=await fetch('/api/status').then(r=>r.json());$('lanhint').textContent=`同一 Wi-Fi 访问：${s.lan?.join(' 或 ')||location.origin}`;}catch{}};
$('closelogin').onclick=()=>$('login').close();
function roomMessage(name,text){const p=document.createElement('p');p.textContent=`${name}：${text}`;p.classList.toggle('aha-message',name==='AHA');$('roommessages').append(p);while($('roommessages').children.length>40)$('roommessages').firstChild.remove();$('roommessages').scrollTop=$('roommessages').scrollHeight;if(!document.body.classList.contains('show-room')){$('touchRoom').textContent=`聊天 ${++unread}`;}}
$('loginForm').onsubmit=e=>{
  e.preventDefault();if(socket)socket.close();myId=null;serverRevision=-1;
  const name=$('nickname').value.trim().slice(0,16)||'探险家',avatar=$('avatar').value;
  socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/room`);
  socket.onopen=()=>sendNet({type:'join',name,avatar});
  const joining=socket;
  const joinButton=$('loginForm').querySelector('button[type="submit"]');
  joinButton.disabled=true;joinButton.textContent='正在连接…';
  const connectionError=text=>{if(socket!==joining)return;joinButton.disabled=false;joinButton.textContent='重试进入房间';$('lanhint').textContent=text;toast(text);};
  const joinTimer=setTimeout(()=>{if(socket===joining&&myId===null){connectionError('连接超时：请确认主机已启动，且设备在同一局域网。');joining.close();}},8000);
  socket.onerror=()=>connectionError('联机连接失败：请使用主机的局域网地址，并确认防火墙允许 TCP 8787。');
  socket.onclose=event=>{clearTimeout(joinTimer);if(socket!==joining)return;roomMessage('世界','连接已断开，请回首页重新加入。');myId=null;connectionError(event.code===1008?'房间已满或连接被拒绝，请稍后重试。':'连接已断开，请重新加入。');};
  socket.onmessage=event=>{
    const m=JSON.parse(event.data);
    if(m.type==='welcome'){clearTimeout(joinTimer);joinButton.disabled=false;joinButton.textContent='进入联机房间';myId=m.id;hostId=m.host;$('login').close();reset('online');animal(playerMesh,avatar);$('roompanel').hidden=false;toast('已加入 AHA-01 · 伙伴的位置和作品会实时同步。');}
    if(m.type==='chat'){
      roomMessage(m.name,m.message);
      if(m.mentions?.includes(myId)){audio.play('chat-mention');notice.textContent=`${m.name} 提到了你：${m.message.slice(0,70)} · 点击查看`;notice.hidden=false;}
      const peer=peers.get(m.by);if(peer){if(peer.bubble){peer.mesh.remove(peer.bubble);peer.bubble.material.map.dispose();peer.bubble.material.dispose();}const bubble=nameTag(m.message.slice(0,16));bubble.position.y=3;peer.mesh.add(bubble);peer.bubble=bubble;setTimeout(()=>{if(peer.bubble===bubble){peer.mesh.remove(bubble);bubble.material.map.dispose();bubble.material.dispose();peer.bubble=null;}},6000);}
    }
    if(m.type==='host')hostId=m.host;
    if(m.type==='restart'){reset('online');serverRevision=-1;}
    if(m.type==='collected'){const r=resources.find(r=>resourceId(r)===m.id);if(r){r.taken=true;r.group.visible=r.ring.visible=false;}}
    if(m.type==='collect-denied'){const r=resources.find(r=>resourceId(r)===m.id);if(r){state.inventory[r.type]=Math.max(0,state.inventory[r.type]-r.amount);toast('这份物资刚被伙伴拾取了。');}}
    if(m.type==='enemy')m.hp.forEach((hp,i)=>{if(enemies[i]){enemies[i].hp=hp;enemies[i].mesh.visible=hp>0;}});
    if(m.type==='world'){
      if(mode!=='online')return;
      $('roomcount').textContent=`AHA-01 · ${m.players.length} / 8 人`;
      if(JSON.stringify(roomPlayers.map(p=>[p.id,p.name]))!==JSON.stringify(m.players.map(p=>[p.id,p.name]))){roomPlayers=m.players;updateMentions();}
      for(const p of m.players){if(p.id===myId)continue;let peer=peers.get(p.id);if(!peer){const mesh=character('#8aa6c5');animal(mesh,p.avatar);mesh.add(nameTag(p.name));peer={mesh,target:new THREE.Vector3()};peers.set(p.id,peer);}peer.target.set(p.x,groundY(p.x,p.z,p.floor)+.07,p.z);peer.rotation=p.rotation;peer.floor=p.floor;}
      for(const [id,p] of peers)if(!m.players.some(x=>x.id===id)){scene.remove(p.mesh);peers.delete(id);}
      state.fire=m.shared.fire;state.beacon=m.shared.beacon;flame.visible=state.fire;fireLight.intensity=state.fire?20:0;beam.visible=state.beacon;beacLight.intensity=state.beacon?14:0;
      m.shared.enemyHp.forEach((hp,i)=>{if(enemies[i])enemies[i].hp=hp;});
      for(const r of resources)if(m.taken.includes(resourceId(r))){r.taken=true;r.group.visible=r.ring.visible=false;}
      if(serverRevision!==m.revision){
        serverRevision=m.revision;
        for(const [id,b] of sharedBlocks){dynamic.remove(b.mesh);b.mesh.geometry.dispose();}sharedBlocks.clear();
        // Local authored blocks are replaced by the room's authoritative snapshot.
        for(const b of blocks){dynamic.remove(b.mesh);b.mesh.geometry.dispose();}blocks=[];
        for(const b of m.blocks){const mesh=cube(.9,.9,.9,palette[b.type],dynamic,b.x,groundY(b.x,b.z,b.floor)+.5,b.z);mesh.userData.floor=b.floor;const obj={...b,w:.9,d:.9,mesh};blocks.push(obj);sharedBlocks.set(b.id,obj);}showFloors();
      }
    }
  };
};
function reportedState(){return {health:state.health,hunger:state.hunger,thirst:state.thirst,elapsed:state.elapsed,inventory:state.inventory,paused};}
$('roomchat').onsubmit=e=>{e.preventDefault();const text=$('roominput').value.trim();if(text)sendNet({type:'chat',message:text,state:reportedState()});$('roominput').value='';};
$('roomrestart').onclick=()=>{if(myId===hostId)sendNet({type:'restart'});else toast('请房主点击重开挑战。');};
const fireCenter={x:3,z:10},beaconCenter=BEACON;
const fireGroup=new THREE.Group();fireGroup.position.set(fireCenter.x,0,fireCenter.z);scene.add(fireGroup);
for(let i=0;i<8;i++){const a=i*Math.PI/4;cube(.33,.20,.33,palette.stone,fireGroup,Math.cos(a)*.55,.16,Math.sin(a)*.55);}
const logs=cube(.7,.15,.25,palette.wood,fireGroup,0,.2,0);const logs2=cube(.7,.15,.25,palette.wood,fireGroup,0,.32,0);logs2.rotation.y=Math.PI/2;
const flame=new THREE.Mesh(new THREE.ConeGeometry(.32,.9,5),mat('#ffb137',2));flame.position.y=.8;fireGroup.add(flame);flame.visible=false;
const fireLight=new THREE.PointLight('#ffa54c',0,12);fireLight.position.set(3,1.4,10);scene.add(fireLight);
const beacon=new THREE.Group();beacon.position.set(BEACON.x,3*FLOOR_HEIGHT,BEACON.z);beacon.userData.floor=3;dynamic.add(beacon);
cube(1.1,.25,1.1,palette.dark,beacon,0,.13,0);cube(.22,1.3,.22,palette.gold,beacon,0,.8,0);
const beaconGem=new THREE.Mesh(new THREE.OctahedronGeometry(.5),palette.crystal);beaconGem.position.y=1.7;beacon.add(beaconGem);
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.65,14,12,1,true),new THREE.MeshBasicMaterial({color:'#93ffcf',transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=8;beacon.add(beam);beam.visible=false;
const beacLight=new THREE.PointLight('#8bffda',0,14);beacLight.position.set(BEACON.x,3*FLOOR_HEIGHT+1.5,BEACON.z);scene.add(beacLight);
marker(3,10,0,'#ffc76a',1.3);marker(BEACON.x,BEACON.z,3,'#8affe0',1.2);
for(let f=0;f<4;f++)marker(LANDINGS[f].x,LANDINGS[f].z,f);
for(const p of Object.values(EXTERIOR_STAIRS))marker(p.x,p.z,p.floor);
marker(WATER.x,WATER.z,0,'#8ad3ea');

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function addResource(type,x,z,f=0,amount=1){
  ({x,z}=nearestWalkable(x,z,f));
  const group=new THREE.Group();group.position.set(x,groundY(x,z,f)+.65,z);group.userData.floor=f;dynamic.add(group);
  const geometry=type==='crystal'?new THREE.OctahedronGeometry(.34):new THREE.BoxGeometry(.46,.46,.46);
  const mesh=new THREE.Mesh(geometry,palette[type]);mesh.castShadow=true;group.add(mesh);
  const ring=marker(x,z,f,type==='crystal'?'#64ffe0':type==='food'?'#f7c16e':'#ffecad',.55);
  resources.push({type,x,z,floor:f,amount,group,ring,taken:false});
}
function seedResources(){
  for(const r of resources){dynamic.remove(r.group,r.ring);r.group.traverse(o=>o.geometry?.dispose());r.ring.geometry.dispose();r.ring.material.dispose();}
  resources=[];
  for(const [x,z] of [[-4,10],[-2,9],[0,10],[6,9],[9,9],[14,7],[15,4],[15,-3]])addResource('wood',x,z,0,2);
  for(const [x,z] of [[0,8],[5,9],[10,8],[13,4],[15,0],[14,-4]])addResource('stone',x,z,0,2);
  for(const [x,z] of [[-2,8],[7,8],[14,9]])addResource('food',x,z,0,1);
  addResource('crystal',-7,2,1);addResource('crystal',0,2,2);addResource('crystal',6,1,3);
  for(const [type,x,z,amount] of OUTDOOR_RESOURCES)addResource(type,x,z,0,amount);
}
function showFloors(){
  for(let f=0;f<floorGroups.length;f++)floorGroups[f].visible=overview||f<=player.floor;
  for(const obj of dynamic.children){const f=obj.userData.floor;if(Number.isInteger(f)&&f>=0)obj.visible=overview||f<=player.floor;}
  for(const r of resources){r.group.visible=r.ring.visible=!r.taken&&(overview||r.floor<=player.floor);}
  playerMesh.visible=mode!=='intro';npcMesh.visible=mode!=='intro';
  $('floorname').textContent=`${player.floor+1}F ${FLOOR_NAMES[player.floor]}`;
  document.querySelectorAll('[data-floor]').forEach(b=>b.classList.toggle('active',+b.dataset.floor===player.floor));
  $('overview').textContent=overview?'跟随玩家':'空间全览';
}
function setFloor(f,landing=LANDINGS[f]){if(f<0||f>3)return;Object.assign(player,nearestWalkable(landing.x,landing.z,f),{floor:f});overview=false;showFloors();toast(`进入 ${f+1}F · ${FLOOR_NAMES[f]}`);}
function reset(nextMode){
  examplePortals.reset();fishingQuest.reset();epoch++;aiGeneration++;aiPending=false;roundCalls=0;aiDue=0;mode=nextMode;paused=false;keys={};overview=false;buildMode=false;
  Object.assign(state,newGame());Object.assign(player,{x:0,z:8.8,floor:0});Object.assign(npc,{x:3,z:9,action:'guard',cooldown:0});
  for(const b of blocks){dynamic.remove(b.mesh);b.mesh.geometry.dispose();}blocks=[];
  seedResources();flame.visible=false;beam.visible=false;fireLight.intensity=beacLight.intensity=0;
  orbit=.64;elevation=.73;distance=28;
  $('intro').hidden=true;$('hud').hidden=false;$('pause').hidden=false;$('credit').hidden=true;$('end').close();
  $('pause').textContent='暂停';$('build').classList.remove('selected');$('modebadge').textContent=mode==='explore'?'探索':'生存';
  $('floorhint').textContent=mode==='explore'?'探索模式可直接点选楼层':'生存模式需到楼梯处换层';
  if(mode==='explore'){state.inventory={wood:40,stone:40,crystal:3,food:9};toast('自由探索：生命与时间冻结，楼层可直达。');}
  else toast('先到发光物资旁按 E 搜集，再去楼梯。');
  spawnEnemies();attackCooldown=dashCooldown=dashTime=commandTime=0;repairState=null;$('repair').hidden=true;$('conversation').hidden=true;
  showFloors();updateHUD();
}
function near(x,z,f=player.floor,r=1.7){return player.floor===f&&Math.hypot(player.x-x,player.z-z)<r;}
function exteriorStair(){return Object.values(EXTERIOR_STAIRS).some(p=>near(p.x,p.z,p.floor,1.4));}
function stair(){const p=LANDINGS[player.floor];return near(p.x,p.z,player.floor,1.5)||exteriorStair();}
function descend(){if(player.floor<1)return;if(exteriorStair())setFloor(0,EXTERIOR_STAIRS.bottom);else setFloor(player.floor-1);}
function resourceNear(){return resources.find(r=>!r.taken&&near(r.x,r.z,r.floor,1.5));}
function active(){return mode!=='intro'&&!paused&&state.status==='playing';}
function interact(){
  if(!active())return;
  if(fishingQuest.interact()||examplePortals.interact())return;
  const r=resourceNear();
  if(r){audio.play(r.type==='crystal'?'crystal-pickup':'item-pickup');r.taken=true;r.group.visible=r.ring.visible=false;state.inventory[r.type]+=r.amount;if(mode==='online')sendNet({type:'collect',id:resourceId(r)});toast(`获得 ${names[r.type]} × ${r.amount}`);updateHUD();return;}
  if(near(BEACON.x,BEACON.z,3,2)){
    if(state.beacon){toast('信标已点亮！回营地等到天亮。');return;}
    startRepair();
    updateHUD();return;
  }
  if(exteriorStair()){if(player.floor===0)setFloor(1,EXTERIOR_STAIRS.top);else descend();return;}
  if(stair()){setFloor(player.floor===3?2:player.floor+1);return;}
  if(near(3,10,0,2.3)){lightFire();return;}
  if(near(WATER.x,WATER.z,0,2)){drink();return;}
  toast('靠近发光物资、楼梯、篝火或信标再按 E。');
}
function lightFire(){
  if(!active())return;
  if(!near(3,10,0,2.5)){toast('到一层庭院的金色篝火圈旁再搭建。');return;}
  if(state.fire){toast('篝火正在为你保暖。');return;}
  if(pay(state.inventory,RULES.fireCost)){state.fire=true;flame.visible=true;fireLight.intensity=20;if(mode==='online')sendNet({type:'fire'});toast('篝火搭好了，附近可抵御夜晚寒冷。');}
  else toast('篝火需要：木材 2 + 石块 1');
  updateHUD();
}
function eat(){if(!active())return;if(state.inventory.food>0){audio.play('eat-food');state.inventory.food--;state.hunger=Math.min(100,state.hunger+35);state.health=Math.min(100,state.health+10);toast('吃了一份食物：饱食 +35，生命 +10');updateHUD();}else toast('没有食物了，找找庭院的橙色物资。');}
function drink(){if(!active())return;if(near(WATER.x,WATER.z,0,2.1)){audio.play('drink-water');state.thirst=100;toast('在庭院补水点补满饮水。');updateHUD();}else toast('饮水点在凉亭旁水池前的蓝色圈，靠近后互动。');}
function shelter(){return (Math.abs(player.x)<7.2&&Math.abs(player.z)<5.2)||(state.fire&&near(3,10,0,4));}
const names={wood:'木材',stone:'石块',crystal:'晶体',food:'食物'};
let enemies=[],attackCooldown=0,dashCooldown=0,dashTime=0,commandTime=0,repairState=null;
const enemyMaterial=mat('#775f8f');
const sword=cube(.12,.12,1.1,palette.white,playerMesh,.5,.85,.7);sword.visible=false;
function spawnEnemies(){
  for(const e of enemies){scene.remove(e.mesh);e.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();});}enemies=[];
  for(let [x,z] of [[-3,9],[14,6],[15,-3]]){
    ({x,z}=nearestWalkable(x,z,0));
    const g=new THREE.Group();cube(.85,.7,.7,enemyMaterial,g,0,.6,0);cube(.16,.13,.07,mat('#ffc865',.5),g,-.22,.72,.38);cube(.16,.13,.07,mat('#ffc865',.5),g,.22,.72,.38);
    const halo=new THREE.Mesh(new THREE.RingGeometry(.85,1,24),new THREE.MeshBasicMaterial({color:'#e9a482',side:THREE.DoubleSide,transparent:true,opacity:.4}));halo.rotation.x=-Math.PI/2;halo.position.y=.1;g.add(halo);
    g.scale.setScalar(CHARACTER_SCALE);scene.add(g);g.position.set(x,0,z);enemies.push({x,z,homeX:x,homeZ:z,hp:3,cooldown:0,mesh:g});
  }
}
function strike(targetEnemy=null){
  if(!active()||attackCooldown>0)return;attackCooldown=.55;sword.visible=true;audio.play('attack-swing');
  if((targetEnemy===null||targetEnemy==='sentry')&&examplePortals.hitSentry())return;
  if(targetEnemy==='sentry'){toast('靠近机械哨犬 2.5 米内才能命中。');return;}
  let hit=false;
  for(const e of enemies)if((!targetEnemy||targetEnemy===e)&&e.hp>0&&player.floor===0&&Math.hypot(e.x-player.x,e.z-player.z)<2.5){
    audio.play('attack-hit');e.hp--;if(mode==='online')sendNet({type:'hit',enemy:enemies.indexOf(e)});hit=true;const dx=e.x-player.x,dz=e.z-player.z,len=Math.hypot(dx,dz)||1;
    if(!blocked(e.x+dx/len,e.z+dz/len,0,colliders,blocks)){e.x+=dx/len;e.z+=dz/len;}
    if(e.hp<=0){e.mesh.visible=false;state.inventory.stone++;state.inventory.food++;toast('击退巡游者 · 石块 +1，食物 +1');}
    else toast(`命中巡游者 · 剩余护甲 ${e.hp}/3`);
  }
  if(!hit)toast('挥击！靠近巡游者 2.5 米内才能命中。');
}
function dash(){if(!active()||dashCooldown>0)return;dashTime=.65;dashCooldown=3;state.hunger=Math.max(0,state.hunger-3);toast('冲刺！3 秒后可以再次使用。');}
function updateEnemies(dt){
  attackCooldown=Math.max(0,attackCooldown-dt);dashCooldown=Math.max(0,dashCooldown-dt);dashTime=Math.max(0,dashTime-dt);commandTime=Math.max(0,commandTime-dt);
  sword.visible=attackCooldown>.25;sword.rotation.y=attackCooldown*6;
  const enabled=mode==='duel'||(['survival','online'].includes(mode)&&state.elapsed>25);
  for(const e of enemies){
    e.mesh.visible=enabled&&e.hp>0;if(!e.mesh.visible)continue;e.cooldown=Math.max(0,e.cooldown-dt);
    const chasing=player.floor===0&&(!shelter()||mode==='duel')&&Math.hypot(e.x-player.x,e.z-player.z)<(state.elapsed>=RULES.nightAt?18:7);
    const tx=chasing?player.x:e.homeX+Math.sin(animationTime*.6)*2,tz=chasing?player.z:e.homeZ+Math.cos(animationTime*.6)*2;
    const dx=tx-e.x,dz=tz-e.z,len=Math.hypot(dx,dz)||1,step=dt*(chasing?2.4:1);
    if(!blocked(e.x+dx/len*step,e.z,0,colliders,blocks))e.x+=dx/len*step;
    if(!blocked(e.x,e.z+dz/len*step,0,colliders,blocks))e.z+=dz/len*step;
    e.mesh.position.set(e.x,groundY(e.x,e.z,0)+Math.sin(animationTime*3)*.07,e.z);e.mesh.rotation.y=Math.atan2(dx,dz);
    if(player.floor===0&&Math.hypot(e.x-player.x,e.z-player.z)<1.1&&e.cooldown===0&&dashTime===0){state.health=Math.max(0,state.health-8);e.cooldown=1.3;toast('被巡游者碰到：生命 -8 · J 反击 / Shift 冲刺');}
  }
  if(mode==='duel'&&enemies.every(e=>e.hp===0)&&state.status==='playing'){state.status='won';$('endtitle').textContent='守住了 AHA 营地！';$('endtext').textContent='你击退了三名巡游者。下一轮试试先建掩体，再用冲刺拉开距离。';$('end').showModal();}
  if(mode==='duel'&&state.health<=0&&state.status==='playing'){state.status='lost';$('endtitle').textContent='这次先撤回营地。';$('endtext').textContent='靠近时挥击，受伤后冲刺。也可以向小芽请求急救。';$('end').showModal();}
}
function startRepair(){
  if(!Object.entries(RULES.beaconCost).every(([k,v])=>state.inventory[k]>=v)){toast('修复信标需要：木材 3 + 石块 2 + 晶体 3');return;}
  repairState={progress:0,time:0,start:.35,end:.58};keys={};$('repair').hidden=false;
}
function lockSignal(){
  if(!repairState||!active())return;const p=(Math.sin(repairState.time*2.6)+1)/2;
  if(p>=repairState.start&&p<=repairState.end){audio.play('task-complete');repairState.progress++;toast(`频率已锁定 ${repairState.progress}/3`);
    if(repairState.progress===3){if(pay(state.inventory,RULES.beaconCost)){state.beacon=true;beam.visible=true;beacLight.intensity=14;if(mode==='online')sendNet({type:'beacon'});toast('三道频率已对齐！信标点亮。');}repairState=null;$('repair').hidden=true;return;}
    repairState.start=repairState.progress===1?.62:.18;repairState.end=repairState.start+.23;
  }else{audio.play('repair-fail');repairState.progress=0;state.health=Math.max(1,state.health-4);toast('频率偏离 · 生命 -4；重新对齐，不消耗材料。');}
}
$('locksignal').onclick=lockSignal;$('cancelrepair').onclick=()=>{repairState=null;$('repair').hidden=true;};
$('attack').onclick=()=>strike();$('dash').onclick=dash;$('duel').onclick=()=>{if(ready)reset('duel');};
function message(text,who='npc'){const p=document.createElement('p');p.className=who;p.textContent=(who==='npc'?'小芽：':'你：')+text;$('messages').append(p);$('messages').scrollTop=$('messages').scrollHeight;}
function talk(){if(mode==='intro')return;$('conversation').hidden=false;keys={};$('chatInput').focus();}
$('talk').onclick=talk;$('closetalk').onclick=()=>{$('conversation').hidden=true;keys={};};
async function sendMessage(text){
  if(!text.trim())return;message(text,'human');$('chatInput').value='';
  const s={health:Math.round(state.health),hunger:Math.round(state.hunger),thirst:Math.round(state.thirst),wood:state.inventory.wood,stone:state.inventory.stone,elapsed:Math.round(state.elapsed),floor:player.floor,night:state.elapsed>=RULES.nightAt,fire:state.fire,beacon:state.beacon,message:text,session:dialogueSession};
  const requestEpoch=epoch;
  try{const r=await fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s),signal:AbortSignal.timeout(7500)});if(!r.ok)throw Error();const d=await r.json();if(requestEpoch!==epoch)return;
    const replies=NPC_REPLIES;
    message(d.replyText||replies[d.reply]||replies.survive);if(['gather','assist'].includes(d.reply)){npc.action=d.reply;commandTime=24;}
    $('aiReason').textContent=d.source==='jev'?'Jev 识别了你的对话意图':d.reason;
  }catch{message('刚才没听清。你可以先用下方的行动按钮；网络恢复后再聊。');}
}
$('chatForm').onsubmit=e=>{e.preventDefault();void sendMessage($('chatInput').value.slice(0,240));};
document.querySelectorAll('[data-message]').forEach(b=>b.onclick=()=>void sendMessage(b.dataset.message));
$('savebuild').onclick=()=>{try{localStorage.setItem('aha-build-v1',JSON.stringify(blocks.map(({x,z,floor,type})=>({x,z,floor,type}))));toast(`已保存 ${blocks.length} 个方块到本机浏览器。`);}catch{toast('浏览器未允许本地保存。');}};
$('loadbuild').onclick=()=>{
  if(mode!=='explore'){toast('请在自由创作模式载入作品。');return;}
  try{const data=JSON.parse(localStorage.getItem('aha-build-v1')||'[]');if(!Array.isArray(data))throw Error();
    for(const b of blocks){dynamic.remove(b.mesh);b.mesh.geometry.dispose();}blocks=[];
    for(const b of data.slice(0,60)){if(!Number.isFinite(b.x)||!Number.isFinite(b.z)||![0,1,2,3].includes(b.floor)||!['wood','stone'].includes(b.type)||blocked(b.x,b.z,b.floor,colliders,blocks))continue;
      const mesh=cube(.9,.9,.9,palette[b.type],dynamic,b.x,groundY(b.x,b.z,b.floor)+.5,b.z);mesh.userData.floor=b.floor;blocks.push({...b,w:.9,d:.9,mesh});}
    showFloors();toast(`已载入 ${blocks.length} 个方块。`);
  }catch{toast('存档不可用。');}
};
const actionNames={gather:'收集木材',assist:'送来急救',shelter:'返回营地',guard:'在营地守候'};
function updateHUD(){
  for(const k of ['health','hunger','thirst']){$(k).value=state[k];$(k+'v').textContent=Math.ceil(state[k]);}
  for(const k in names)$(k).textContent=state.inventory[k];
  $('shelter').textContent=shelter()?'温暖 · 有庇护':'庭院 · 无庇护';
  $('quest1').textContent=`${state.fire?'✓':'○'} 搭建篝火（木 2 / 石 1）`;
  $('quest2').textContent=`${state.inventory.crystal>=3||state.beacon?'✓':'○'} 收集三层晶体 ${state.beacon?3:state.inventory.crystal}/3`;
  $('quest3').textContent=`${state.beacon?'✓':'○'} 修复露台信标（木 3 / 石 2）`;
  $('quest4').textContent=`${state.status==='won'?'✓':'○'} 撑到天亮 · 剩余 ${Math.ceil(Math.max(0,RULES.duration-state.elapsed))} 秒`;
  $('clock').textContent=mode==='intro'?'一座房子，一整个世界。':mode==='explore'?'自由探索 · 时间冻结':`${state.elapsed>=RULES.nightAt?'☾ 夜晚':'☀ 白天'}  /  ${Math.ceil(Math.max(0,RULES.duration-state.elapsed))}s`;
  let hint='WASD 移动 · 靠近发光物资按 E';
  const r=resourceNear();
  if(r)hint=`E  拾取${names[r.type]} × ${r.amount}`;
  else if(stair())hint=player.floor===3?'E / Q  下楼 · 也可点右侧「下楼」':`E  上楼${player.floor>0?' / Q 下楼':''}`;
  else if(near(BEACON.x,BEACON.z,3,2))hint=state.beacon?'信标已点亮 · 回庭院篝火边等待天亮':'E  修复信标 · 木材 3 / 石块 2 / 晶体 3';
  else if(near(3,10,0,2.5))hint=state.fire?'温暖的篝火 · 等待天亮':'E / C  搭建篝火 · 木材 2 / 石块 1';
  else if(near(WATER.x,WATER.z,0,2))hint='E / R  补满饮水';
  if(buildMode)hint=`建造：点击附近地面放${names[selectedBlock]} · 右键回收自己的方块 · B 退出`;
  if(paused)hint='游戏已暂停 · Esc 或上方按钮继续';
  $('prompt').textContent=hint;
}
function displayDecision(d){
  lastDecision=d;$('npcAction').textContent=actionNames[d.choice];$('aiSource').textContent=d.source==='jev'?'Jev 在线':'本地规则';
  $('aiReason').textContent=d.reason;$('confidence').textContent=d.confidence==null?'—':`${Math.round(d.confidence*100)}%`;
  $('urgency').textContent=`${Number(d.urgency).toFixed(1)}/2`;$('danger').textContent=`${Math.round(d.danger*100)}%`;
  $('latency').textContent=d.latencyMs?`${d.latencyMs} ms · 端到端`:'规则执行 · 无网络调用';
  $('calls').textContent=`${d.calls??0} 次调用`;
  $('probabilities').replaceChildren();
  if(d.probabilities)for(const [key,label] of Object.entries(actionNames)){
    const row=document.createElement('div');row.className='prob';const l=document.createElement('label');l.textContent=label.slice(0,2);
    const track=document.createElement('i'),bar=document.createElement('b'),v=document.createElement('span');
    const p=Math.max(0,Math.min(1,Number(d.probabilities[key])||0));bar.style.width=`${p*100}%`;v.textContent=`${Math.round(p*100)}%`;track.append(bar);row.append(l,track,v);$('probabilities').append(row);
  }
}
async function decide(){
  if(aiPending||!active()||roundCalls>=60)return;
  const s={health:Math.round(state.health),hunger:Math.round(state.hunger),thirst:Math.round(state.thirst),wood:state.inventory.wood,stone:state.inventory.stone,elapsed:Math.round(state.elapsed),floor:player.floor,night:state.elapsed>=RULES.nightAt,fire:state.fire,beacon:state.beacon};
  $('aistate').textContent=JSON.stringify(s,null,2);
  if(!aiEnabled){const d={...localDecision(s),reason:'AI 已关闭 · 本地规则'};npc.action=d.choice;displayDecision(d);return;}
  const requestEpoch=epoch,gen=++aiGeneration;aiPending=true;
  try{
    const response=await fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s),signal:AbortSignal.timeout(7500)});
    if(!response.ok)throw Error('decision_http');const d=await response.json();
    if(requestEpoch!==epoch||gen!==aiGeneration||!active()||!aiEnabled)return;
    if(!actionNames[d.choice])throw Error('decision_invalid');
    roundCalls++;if(commandTime===0)npc.action=d.choice;displayDecision(d);
  }catch{if(requestEpoch===epoch&&gen===aiGeneration&&active()){const d={...localDecision(s),reason:'连接暂不可用 · 本地规则'};npc.action=d.choice;displayDecision(d);}}
  finally{if(requestEpoch===epoch&&gen===aiGeneration)aiPending=false;}
}
function walk(entity,dx,dz,dt,isNpc=false){
  const f=isNpc?0:entity.floor;
  const obstacles=colliders;
  let moved=false;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
  for(let i=0;i<steps;i++){
    if(!blocked(entity.x+dx/steps,entity.z,f,obstacles,blocks)){entity.x+=dx/steps;moved=true;}
    if(!blocked(entity.x,entity.z+dz/steps,f,obstacles,blocks)){entity.z+=dz/steps;moved=true;}
  }
  const mesh=isNpc?npcMesh:playerMesh;
  if(moved&&(dx||dz)){mesh.rotation.y=Math.atan2(dx,dz);mesh.userData.limbs.forEach((m,i)=>m.rotation.x=Math.sin(animationTime*10+(i%2)*Math.PI)*.4);}
  else mesh.userData.limbs.forEach(m=>m.rotation.x=0);
}
function updateNPC(dt){
  npc.cooldown=Math.max(0,npc.cooldown-dt);let tx=3,tz=9;
  if(npc.action==='gather'){tx=-4;tz=10;}
  if(npc.action==='assist'&&player.floor===0){tx=player.x;tz=player.z;}
  if(npc.action==='shelter'){tx=3;tz=10;}
  const dx=tx-npc.x,dz=tz-npc.z,len=Math.hypot(dx,dz);
  if(len>.6)walk(npc,dx/len*Math.min(len,dt*2.4),dz/len*Math.min(len,dt*2.4),dt,true);
  if(len<1&&npc.cooldown===0){
    if(npc.action==='gather'){
      const r=resources.find(r=>r.type==='wood'&&!r.taken&&r.floor===0&&Math.hypot(r.x-npc.x,r.z-npc.z)<1.5);
      if(r){r.taken=true;r.group.visible=r.ring.visible=false;state.inventory.wood+=r.amount;toast('小芽帮你收集了木材 ×2');}
    }
    if(npc.action==='assist'&&player.floor===0&&state.health<85){state.health=Math.min(100,state.health+12);toast('小芽送来急救：生命 +12');}
    npc.cooldown=10;
  }
  npcMesh.position.set(npc.x,groundY(npc.x,npc.z,0)+.05,npc.z);
}
function togglePause(){if(fishingQuest.holdsPause||examplePortals.holdsPause)return;if(mode==='intro'||state.status!=='playing')return;paused=!paused;keys={};$('pause').textContent=paused?'继续':'暂停';updateHUD();}
$('start').onclick=()=>reset('survival');$('explore').onclick=()=>{if(ready)reset('explore');};
$('restart').onclick=()=>reset('survival');$('freeafter').onclick=()=>reset('explore');
$('pause').onclick=togglePause;
$('overview').onclick=()=>{overview=!overview;showFloors();};
$('build').onclick=()=>{if(!active())return;buildMode=!buildMode;$('build').classList.toggle('selected',buildMode);updateHUD();};
$('fire').onclick=lightFire;$('touchE').onclick=interact;
$('aiToggle').onclick=()=>{aiEnabled=!aiEnabled;aiGeneration++;aiPending=false;aiDue=0;$('aiToggle').textContent=aiEnabled?'AI 开':'AI 关';toast(aiEnabled?'已启用 Jev 决策':'已切换到本地规则');};
document.querySelectorAll('[data-floor]').forEach(b=>b.onclick=()=>{if(!active())return;const f=+b.dataset.floor;if(mode==='explore'||(stair()&&Math.abs(f-player.floor)===1))setFloor(f);else toast('到青色楼梯圈旁，可点相邻楼层；E 上楼 / Q 下楼。');});
const downButton=document.createElement('button');downButton.id='downstairs';downButton.textContent='↓ 下楼 Q';downButton.style.marginTop='8px';$('floorbox').append(downButton);
downButton.onclick=()=>{if(!active())return;if(player.floor>0){if(stair())descend();else{setFloor(player.floor);toast('已返回本层楼梯口，再点「下楼」。');}}else toast('已经在一层。');};
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if($('end').open)return;
  keys[k]=true;if(e.repeat)return;
  if(k==='escape'){togglePause();return;}if(!active())return;
  if(k==='e')interact();if(k==='q'&&stair()&&player.floor>0)descend();
  if(k==='f')eat();if(k==='r')drink();if(k==='c')lightFire();if(k==='b')$('build').click();
  if(k==='j')strike();if(k==='shift')dash();if(k==='t')talk();if(k===' '&&repairState)lockSignal();
  if(k==='1')selectedBlock='wood';if(k==='2')selectedBlock='stone';
});
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
window.addEventListener('blur',()=>{keys={};if(active())togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())togglePause();});
document.querySelectorAll('[data-key]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>keys[b.dataset.key]=false);
});
let drag=null;
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!buildMode){orbit-=dx*.006;elevation=THREE.MathUtils.clamp(elevation+dy*.004,.28,1.3);}drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{
  if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<7){
    if(buildMode)placeBlock(e,drag.button===2||touchReclaim);
    else if(active()){
      const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      if(fishingQuest.click(ray)){drag=null;return;}
      const portalHit=examplePortals.click(ray);if(portalHit){if(portalHit==='sentry')strike('sentry');drag=null;return;}
      const hit=ray.intersectObjects(enemies.filter(enemy=>enemy.mesh.visible).map(enemy=>enemy.mesh),true)[0];
      const enemy=hit&&enemies.find(enemy=>{let object=hit.object;while(object){if(object===enemy.mesh)return true;object=object.parent;}return false;});
      if(enemy)strike(enemy);
    }
  }
  drag=null;
});
canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.025,12,65);},{passive:false});
function placeBlock(event,reclaim){
  if(!active())return;
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1),camera);
  if(reclaim){
    const hits=ray.intersectObjects(blocks.map(b=>b.mesh));const b=blocks.find(b=>b.mesh===hits[0]?.object);
    if(b&&b.floor===player.floor&&Math.hypot(b.x-player.x,b.z-player.z)<4){if(mode==='online'){if(b.owner!==myId){toast('只能回收自己搭建的方块。');return;}sendNet({type:'remove',id:b.id});}audio.play('build-remove');dynamic.remove(b.mesh);b.mesh.geometry.dispose();blocks=blocks.filter(x=>x!==b);state.inventory[b.type]++;toast('已回收自己的方块');}return;
  }
  const p=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-groundY(player.x,player.z,player.floor)-.06),p))return;
  const x=Math.round(p.x),z=Math.round(p.z),f=player.floor;
  if(Math.hypot(x-player.x,z-player.z)>3.5||Math.hypot(x-player.x,z-player.z)<1){toast('只能在身边 1–3.5 米范围内放置。');return;}
  const reserved=[[LANDINGS[f].x,LANDINGS[f].z,f],[3,10,0],[WATER.x,WATER.z,0],[BEACON.x,BEACON.z,3],...Object.values(EXTERIOR_STAIRS).map(p=>[p.x,p.z,p.floor]),...resources.filter(r=>!r.taken).map(r=>[r.x,r.z,r.floor])];
  if(reserved.some(([rx,rz,rf])=>rf===f&&Math.hypot(x-rx,z-rz)<2)||blocked(x,z,f,colliders,blocks)||Math.hypot(x-npc.x,z-npc.z)<1){toast('这里是通道或已有物体，请换个位置。');return;}
  if(blocks.length>=60){toast('本轮最多放置 60 个方块。');return;}
  if(!pay(state.inventory,{[selectedBlock]:1})){toast(`没有足够的${names[selectedBlock]}`);return;}
  const mesh=cube(.9,.9,.9,palette[selectedBlock],dynamic,x,groundY(x,z,f)+.5,z);mesh.userData.floor=f;
  audio.play(selectedBlock==='stone'?'build-stone':'build-place');blocks.push({x,z,w:.9,d:.9,floor:f,type:selectedBlock,mesh});if(mode==='online')sendNet({type:'build',block:{x,z,floor:f,type:selectedBlock}});updateHUD();
}
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;animationTime+=dt;
  if(mode==='online'&&now-lastStatus>2000){sendNet({type:'status',state:reportedState()});lastStatus=now;}
  if(active()){
    let dx=Number(!!(keys.d||keys.arrowright))-Number(!!(keys.a||keys.arrowleft));
    let dz=Number(!!(keys.s||keys.arrowdown))-Number(!!(keys.w||keys.arrowup));
    const length=Math.hypot(dx,dz);if(length){dx/=length;dz/=length;}
    // Movement is relative to the camera, with normalized diagonals.
    if(!$('conversation').hidden||repairState){dx=0;dz=0;}
    const speed=RULES.speed*(dashTime>0?2.2:1);
    walk(player,(dx*Math.cos(orbit)+dz*Math.sin(orbit))*speed*dt,(-dx*Math.sin(orbit)+dz*Math.cos(orbit))*speed*dt,dt);
    playerMesh.position.set(player.x,groundY(player.x,player.z,player.floor)+.07,player.z);
    updateNPC(dt);
    updateEnemies(dt);
    if(repairState){repairState.time+=dt;$('repairneedle').style.left=`${(Math.sin(repairState.time*2.6)+1)*50}%`;$('repairzone').style.left=`${repairState.start*100}%`;$('repairprogress').textContent=`${repairState.progress} / 3 · 对准绿色区间再锁定`;}
    if(mode==='survival'||mode==='online'){
      const wasNight=state.elapsed>=RULES.nightAt;
      tickState(state,dt,shelter());
      if(!wasNight&&state.elapsed>=RULES.nightAt)toast('天黑了。室内或篝火附近可以保暖。');
      if(state.status!=='playing'){
        $('endtitle').textContent=state.status==='won'?'第一夜，被你点亮了。':'再给这个世界一次机会。';
        $('endtext').textContent=state.status==='won'?'你搜集了三枚晶体，修复了信标，也活到了天亮。下一轮，试试改变一条规则。':state.health<=0?'生命耗尽了。记得吃东西、补水，在夜晚回到室内或篝火边。':'天亮了，但信标还没有修复。下一轮先搜集三层晶体，再去四层带遮阳伞的大露台。';
        $('end').showModal();keys={};
      }
    }
    aiDue-=dt;if(aiDue<=0){aiDue=RULES.aiInterval;void decide();}
  }
  if(mode==='online'){if(now-lastNet>100){sendNet({type:'move',x:player.x,z:player.z,floor:player.floor,rotation:playerMesh.rotation.y});lastNet=now;}for(const p of peers.values()){p.mesh.position.lerp(p.target,.3);p.mesh.rotation.y=p.rotation;p.mesh.visible=overview||p.floor<=player.floor;}}
  const night=['survival','online'].includes(mode)?THREE.MathUtils.smoothstep(state.elapsed,RULES.nightAt-10,RULES.nightAt+10):0;
  document.body.classList.toggle('night',night>.6);
  const bg=new THREE.Color('#dce9df').lerp(new THREE.Color('#183849'),night);scene.background.copy(bg);scene.fog.color.copy(bg);waterGround.material.color.copy(new THREE.Color('#b4d6cb').lerp(new THREE.Color('#254e5a'),night));
  hemi.intensity=2.3-night*1.7;sun.intensity=3-night*2.7;
  flame.scale.setScalar(1+Math.sin(animationTime*8)*.1);
  beaconGem.rotation.y=animationTime*.7;
  for(const r of resources)if(!r.taken){r.group.position.y=groundY(r.x,r.z,r.floor)+.65+Math.sin(animationTime*2+r.x)*.10;r.group.rotation.y=animationTime*.6;}
  if(mode==='intro'){
    const mobile=innerWidth<760;target.set(mobile?3:-4,mobile?5:4,0);
    cameraTarget.set(target.x+Math.sin(orbit)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(orbit)*Math.cos(elevation)*distance);
  }else{
    const desired=overview?new THREE.Vector3(0,4,0):new THREE.Vector3(player.x,player.floor*FLOOR_HEIGHT+.7,player.z);
    target.lerp(desired,.08);
    const dist=overview?76:distance;
    cameraTarget.set(target.x+Math.sin(orbit)*Math.cos(elevation)*dist,target.y+Math.sin(elevation)*dist,target.z+Math.cos(orbit)*Math.cos(elevation)*dist);
  }
  camera.position.lerp(cameraTarget,.09);camera.lookAt(target);updateOcclusion(now);renderer.render(scene,camera);
  examplePortals.update(dt,mode);
  fishingQuest.update(animationTime,mode);
  audio.update(state,mode,paused,RULES.nightAt,dt,player,WATER);
  if(mode!=='intro')updateHUD();
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
window.addEventListener('resize',resize);resize();camera.position.set(30,30,40);requestAnimationFrame(frame);
try{
  const draco=new DRACOLoader().setDecoderPath('/vendor/examples/jsm/libs/draco/gltf/').setWorkerLimit(2);
  const [gltf,data]=await Promise.all([new GLTFLoader().setDRACOLoader(draco).loadAsync('assets/explorer-hall.glb',e=>{if(e.total)$('loadstatus').textContent=`载入探索工坊 ${Math.round(e.loaded/e.total*100)}%`;}),fetch('assets/navigation.json').then(r=>{if(!r.ok)throw Error('manifest_missing');return r.json();})]);
  world=gltf.scene;colliders=[];setNavigation(data);scene.add(world);draco.dispose();
  const outdoor=createOutdoor();scene.add(outdoor.group);outdoor.group.updateMatrixWorld(true);groundSurfaces[0].push(...outdoor.surfaces);
  const soil=world.getObjectByName('Island_soil');if(soil)soil.position.y-=.24;
  world.updateMatrixWorld(true);
  world.traverse(o=>{if(o.isMesh){o.castShadow=!matchMedia('(pointer:coarse)').matches;o.receiveShadow=true;
    let root=o;while(root&&root.userData.floor===undefined)root=root.parent;const f=root?.userData.floor;
    if(Number.isInteger(f)){const box=new THREE.Box3().setFromObject(o);if(box.max.y<=f*FLOOR_HEIGHT+.65&&box.min.y>=f*FLOOR_HEIGHT-.5&&(box.max.x-box.min.x)*(box.max.z-box.min.z)>1)groundSurfaces[f].push(o);
      if(box.max.y-box.min.y>1&&(box.max.x-box.min.x<.6||box.max.z-box.min.z<.6)){o.userData.floor=f;occluders.push(o);}
    }
  }});
  for(const o of dynamic.children)if(o.isMesh&&o.geometry.type==='RingGeometry')o.position.y=groundY(o.position.x,o.position.z,o.userData.floor)+.09;
  fireGroup.position.y=groundY(3,10,0);beacon.position.y=groundY(BEACON.x,BEACON.z,3);
  floorGroups=[0,1,2,3].map(f=>world.getObjectByName(`Floor_${f+1}`));
  if(floorGroups.some(g=>!g))throw Error('floor_groups_missing');
  examplePortals.initialize();fishingQuest.initialize();seedResources();ready=true;$('start').disabled=false;$('joinroom').disabled=false;$('start').textContent='开始第一夜  ↗';$('loadstatus').textContent='空间已准备好 · 拖动即可环顾';
}catch(error){$('loadstatus').textContent='空间载入失败，请从启动脚本打开并刷新。';console.error(error);}
// Read-only observable state supports classroom inspection and browser verification.
window.aha={exampleQuests:examplePortals.snapshot,quest:fishingQuest.snapshot,audio:audio.diagnostics,snapshot:()=>({ready,mode,paused,overview,player:{...player},npc:{...npc},state:structuredClone(state),resources:resources.map(({type,x,z,floor,taken})=>({type,x,z,floor,taken})),blocks:blocks.map(({x,z,floor,type})=>({x,z,floor,type})),decision:lastDecision,meshes:world?world.children.length:0})};
