import {createNightWorld} from './night.mjs';
import {createEffects} from './effects.mjs';
import {createGameAudio} from './audio.mjs';
import {planRooftop,ROOF_Y,EYE_HEIGHT} from './rooftop.mjs';
import * as THREE from './vendor/three.module.js';
import {LEVELS,generateLevel,validateCustom,neighbors,findPath,cellKey} from './levels.mjs';
import {CELL_SIZE,canOccupy,moveWithCollisions,boxTouchesWalls} from './collision.mjs';
import {CHARACTERS as SKINS,createCharacter,portrait} from './characters.mjs';
import {THEMES as PALETTES} from './themes.mjs';
const $=s=>document.querySelector(s),CELL=CELL_SIZE;
let selected=0,skin=0,unlocked=1;try{unlocked=Math.max(1,Math.min(10,Number(localStorage.getItem('paper-maze-progress-v1'))||1));}catch{}
let custom=null;const params=new URLSearchParams(location.search);if(params.has('custom')){try{custom=validateCustom(JSON.parse(sessionStorage.getItem('paper-maze-custom')));}catch(e){$('#error').hidden=false;$('#error-text').textContent=e.message+'。请返回编辑器重新试玩。';}}
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;$('#world').append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.06,160);camera.rotation.order='YXZ';scene.add(camera);
let root=new THREE.Group();scene.add(root);const ambient=new THREE.HemisphereLight(0xe4f9df,0x5a6650,2.1);scene.add(ambient);const sun=new THREE.DirectionalLight(0xffefc4,2.2);sun.position.set(22,38,16);scene.add(sun);
const hand=new THREE.Group();camera.add(hand);hand.scale.setScalar(.67);hand.position.set(.08,-.13,-.17);let data,state='menu',yaw=0,pitch=0,health=3,collected=0,keysFound=0,defeated=0,items=[],enemies=[],markers=[],hintMeshes=[],exitObject,elapsed=0,lastAttack=-10,invulnerable=0,hintUntil=0,toastUntil=0,clock=0,walkDistance=0;let roof,phase='ground',climb=null,groundFog,night,effects;
const pressed=new Set();
const sound=createGameAudio(updateSoundControls);
function updateSoundControls(){
  const p=sound.settings();
  for(const key of ['music','effects','musicVolume','effectsVolume'])document.querySelectorAll('[data-audio="'+key+'"]').forEach(el=>{
    if(el.type==='checkbox')el.checked=p[key];else el.value=Math.round(p[key]*100);
  });
  document.querySelectorAll('[data-audio-status]').forEach(el=>el.textContent=p.error);
}
document.querySelectorAll('[data-audio]').forEach(el=>el.addEventListener('input',()=>{
  sound.set({[el.dataset.audio]:el.type==='checkbox'?el.checked:Number(el.value)/100});
}));
updateSoundControls();
window.addEventListener('pagehide',()=>sound.setActive(false));
function tone(freq=600){sound.tone(freq);}
function tex(p,floor=false){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');c.fillStyle=floor?p.floor:p.wall;c.fillRect(0,0,64,64);let seed=17;for(let i=0;i<180;i++){seed=(seed*16807)%2147483647;const x=seed%64;seed=(seed*16807)%2147483647;const y=seed%64;c.fillStyle=i%2?'#ffffff0b':'#0000000c';c.fillRect(x,y,2+(i%3),2+(i%3));}if(!floor){c.fillStyle=p.mortar;for(let y=0;y<64;y+=16){c.fillRect(0,y,64,2);for(let x=(y%32?16:0);x<64;x+=32)c.fillRect(x,y,2,16);}c.fillStyle=p.light;for(let y=2;y<64;y+=16)c.fillRect(0,y,64,1);}else{c.fillStyle='#55584422';c.fillRect(0,0,64,1);c.fillRect(0,0,1,64);}const t=new THREE.CanvasTexture(canvas);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.colorSpace=THREE.SRGBColorSpace;return t;}
function mat(color,extra={}){return new THREE.MeshLambertMaterial({color,...extra});}
function box(w,h,d,material,x=0,y=0,z=0,parent=root){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;}
function voxelActor(color=0xcb9957){const g=new THREE.Group(),body=mat(color),dark=mat(0x304635),face=mat(0xf1d4a0);box(.7,.75,.42,body,0,.9,0,g);box(.68,.6,.6,face,0,1.57,0,g);box(.74,.16,.68,body,0,1.88,0,g);box(.24,.5,.3,dark,-.2,.3,0,g);box(.24,.5,.3,dark,.2,.3,0,g);box(.23,.65,.3,body,-.48,.94,0,g);box(.23,.65,.3,body,.48,.94,0,g);box(.09,.1,.025,dark,-.17,1.6,.31,g);box(.09,.1,.025,dark,.17,1.6,.31,g);return g;}
function disposeTree(group){const geos=new Set(),mats=new Set(),textures=new Set();group.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){mats.add(m);if(m.map)textures.add(m.map);}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();}
function setupHand(){disposeTree(hand);const sleeve=mat(SKINS[skin].color);box(.27,.53,.3,sleeve,.52,-.52,-.72,hand);box(.25,.23,.28,mat(SKINS[skin].skin),.52,-.21,-.73,hand);if(data?.npcs){box(.095,.7,.095,mat(0xb29159),.54,-.05,-.83,hand);box(.2,.24,.2,mat(0xcff59b,{emissive:0x5f9143}),.54,.34,-.83,hand);}hand.visible=false;}

const handBounds=new THREE.Box3();
function updateHandPose(){
  // Retract toward the camera before any part of the hand/wand enters a wall.
  // Check the actual transformed mesh, including the attack swing and looking up/down.
  function pose(t){
    hand.scale.setScalar(THREE.MathUtils.lerp(.67,.18,t));
    hand.position.set(THREE.MathUtils.lerp(.08,.015,t),THREE.MathUtils.lerp(-.13,-.04,t),THREE.MathUtils.lerp(-.17,-.02,t));
    hand.updateWorldMatrix(true,true);
    return boxTouchesWalls(data.grid,handBounds.setFromObject(hand));
  }
  if(!pose(0))return;
  let blocked=0,safe=1;
  for(let i=0;i<9;i++){const middle=(blocked+safe)/2;if(pose(middle))blocked=middle;else safe=middle;}
  pose(safe);
}

function movePlayer(dx,dz){
  const next=moveWithCollisions(phase==='roof'?roof.walkGrid:data.grid,camera.position,dx,dz);
  walkDistance+=Math.hypot(next.x-camera.position.x,next.z-camera.position.z);
  camera.position.x=next.x;camera.position.z=next.z;
}

function distanceToCell(p){return Math.hypot(camera.position.x-p[0]*CELL,camera.position.z-p[1]*CELL);}
function updateLadderPrompt(){
  const nearby=night?.nearby(phase),fireButton=$('#ignite');if(fireButton){fireButton.hidden=!nearby||!!climb;fireButton.textContent=nearby?.source?'E · 取火种':'E · 点亮火把';}
  const b=$('#ladder');if(!b)return;
  b.hidden=!!climb||distanceToCell(phase==='roof'?roof.landing:data.exit)>1.4;
  b.textContent=phase==='roof'?'E · 下梯子':'E · 爬上梯子';
}
function ignite(){
  if(state!=='playing'||climb)return;
  const result=night.interact(phase);if(!result)return;
  toast(result.message);
  if(result.kind!=='missing'){sound.cue('ignite');effects.fire(result.position);updateHUD();}
}
function useNearby(){
  if(!climb&&distanceToCell(phase==='roof'?roof.landing:data.exit)<1.4)useLadder();
  else if(night?.nearby(phase))ignite();else useLadder();
}
function buildLadderAndRails(){
  const [dx,dz]=roof.direction,g=new THREE.Group(),wood=mat(0xe9b957),rung=mat(0xffe4a3);
  g.position.set(data.exit[0]*CELL+dx*1.34,0,data.exit[1]*CELL+dz*1.34);
  g.rotation.y=Math.atan2(dx,dz);
  for(const x of [-.44,.44])box(.12,ROOF_Y+.38,.13,wood,x,(ROOF_Y+.38)/2,0,g);
  for(let y=.3;y<ROOF_Y+.2;y+=.38)box(.95,.1,.16,rung,0,y,-.05,g);
  root.add(g);
  // Physical wall-top bounds match the movement grid. Low rails make edges legible.
  const edges=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let z=0;z<roof.walkGrid.length;z++)for(let x=0;x<roof.walkGrid[z].length;x++)if(roof.walkGrid[z][x]===0)
    for(const [a,b] of dirs)if(roof.walkGrid[z+b]?.[x+a]!==0){
      if(x===roof.landing[0]&&z===roof.landing[1]&&a===-dx&&b===-dz)continue;
      edges.push({x:x*CELL+a*1.44,z:z*CELL+b*1.44,a,b});
    }
  const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat(0x879278),edges.length*3),dummy=new THREE.Object3D();
  edges.forEach((e,i)=>{
    dummy.position.set(e.x,ROOF_Y+.48,e.z);dummy.scale.set(e.a?.08:CELL,.09,e.a?CELL:.08);dummy.updateMatrix();rail.setMatrixAt(i*3,dummy.matrix);
    for(let j=0;j<2;j++){dummy.position.set(e.x+(e.b?(j?1.4:-1.4):0),ROOF_Y+.24,e.z+(e.a?(j?1.4:-1.4):0));dummy.scale.set(.08,.48,.08);dummy.updateMatrix();rail.setMatrixAt(i*3+j+1,dummy.matrix);}
  });root.add(rail);
  const beacon=new THREE.Group();box(.09,1.1,.09,wood,0,ROOF_Y+.55,0,beacon);box(.5,.3,.04,rung,.24,ROOF_Y+.95,0,beacon);
  beacon.position.set(roof.landing[0]*CELL+.6,0,roof.landing[1]*CELL+.6);root.add(beacon);
}
function useLadder(){
  if(state!=='playing'||climb)return;
  const up=phase==='ground',target=up?data.exit:roof.landing;
  if(distanceToCell(target)>1.4){toast('走近金色梯子，再按 E。');return;}
  const [dx,dz]=roof.direction,grab=new THREE.Vector3(data.exit[0]*CELL+dx*1.04,EYE_HEIGHT,data.exit[1]*CELL+dz*1.04);
  const high=grab.clone();high.y=ROOF_Y+EYE_HEIGHT;
  const landing=new THREE.Vector3(roof.landing[0]*CELL,high.y,roof.landing[1]*CELL);
  const ground=new THREE.Vector3(data.exit[0]*CELL,EYE_HEIGHT,data.exit[1]*CELL);
  climb={up,time:0,points:up?[camera.position.clone(),grab,high,landing]:[camera.position.clone(),high,grab,ground]};
  phase=up?'climbing':'descending';exitObject.group.visible=false;pressed.clear();hand.visible=false;
  hintMeshes.forEach(m=>m.visible=false);yaw=Math.atan2(-dx,-dz);pitch=up?-.15:.15;camera.rotation.set(pitch,yaw,0,'YXZ');updateHUD();
}
function advanceClimb(dt){
  if(!climb||state!=='playing')return;
  climb.time=Math.min(2.4,climb.time+dt);
  const t=climb.time,a=t<.4?0:t<2?1:2,u=a===0?t/.4:a===1?(t-.4)/1.6:(t-2)/.4;
  camera.position.lerpVectors(climb.points[a],climb.points[a+1],Math.min(1,u));
  if(t>=2.4){
    const up=climb.up;climb=null;phase=up?'roof':'ground';exitObject.group.visible=up;hand.visible=true;
    scene.fog.near=night.enabled?9:up?24:13;scene.fog.far=night.enabled?26:up?camera.far-10:groundFog;
    if(up){yaw=Math.atan2(-(roof.door[0]*CELL-camera.position.x),-(roof.door[1]*CELL-camera.position.z));pitch=.08;}
    invulnerable=clock+3;updateHUD();toast(up?'站上墙顶了！找到发光的门，沿有护栏的墙顶走过去。':'回到迷宫了。收集好物品，还可以从这里爬上去。');
  }
}

function build(level){night?.dispose();effects?.dispose();data=level;roof=planRooftop(data.grid,data.exit,data.roofExit);data.roofExit=roof.door;phase='ground';climb=null;disposeTree(root);scene.remove(root);root=new THREE.Group();scene.add(root);const p=PALETTES[data.theme];const dark=data.index>=4;ambient.intensity=dark?0:2.1;sun.intensity=dark?0:2.2;renderer.shadowMap.enabled=dark;renderer.shadowMap.type=THREE.PCFSoftShadowMap;scene.background=new THREE.Color(dark?0x000000:p.sky);scene.fog=new THREE.Fog(dark?0x000000:p.fog,dark?9:13,dark?26:46);groundFog=scene.fog.far;camera.far=Math.max(160,Math.hypot(data.grid.length,data.grid[0].length)*CELL+30);camera.updateProjectionMatrix();const wallmat=mat(0xffffff,{map:tex(p)}),floormat=mat(0xffffff,{map:tex(p,true)}),capmat=mat(p.cap),walls=[];const rows=data.grid.length,cols=data.grid[0].length;
  const floorTexture=floormat.map;floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(cols,rows);const floor=new THREE.Mesh(new THREE.PlaneGeometry(cols*CELL,rows*CELL),floormat);floor.rotation.x=-Math.PI/2;floor.position.set((cols-1)*CELL/2,-.02,(rows-1)*CELL/2);root.add(floor);
  for(let z=0;z<rows;z++)for(let x=0;x<cols;x++)if(data.grid[z][x])walls.push([x,z]);
  const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(CELL,3.6,CELL),wallmat,walls.length),caps=new THREE.InstancedMesh(new THREE.BoxGeometry(CELL+.04,.22,CELL+.04),capmat,walls.length),dummy=new THREE.Object3D();walls.forEach(([x,z],i)=>{dummy.position.set(x*CELL,1.8,z*CELL);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);dummy.position.y=3.64;dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);});inst.castShadow=true;inst.receiveShadow=true;caps.castShadow=true;caps.receiveShadow=true;floor.receiveShadow=true;root.add(inst,caps);
  // 暖色路灯与苔藓：只装饰本来就能看到的走廊。
  const stone=mat(0x687457),lamp=mat(0xf4d080,{emissive:0xb17727});let count=0;for(let z=1;z<rows-1;z++)for(let x=1;x<cols-1;x++)if(data.grid[z][x]===0&&++count%9===0){const wallSide=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>data.grid[z+dz]?.[x+dx]===1);if(wallSide){const [dx,dz]=wallSide;box(.22,.55,.22,stone,x*CELL+dx*1.35,1.7,z*CELL+dz*1.35);box(.3,.32,.3,lamp,x*CELL+dx*1.32,2.13,z*CELL+dz*1.32);}}
  items=data.items.map((i,j)=>{const group=new THREE.Group();group.position.set(i.cell[0]*CELL,1,i.cell[1]*CELL);if(i.type==='gem'){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.38),mat(0xf8ce65,{emissive:0x8b5715}));group.add(gem);box(.7,.1,.7,mat(0x72865b),0,-.93,0,group);}else{const gold=mat(0xf6cb54,{emissive:0x745321});box(.13,.65,.13,gold,0,0,0,group);const ring=new THREE.Mesh(new THREE.TorusGeometry(.21,.075,4,8),gold);ring.position.y=.4;group.add(ring);box(.2,.09,.12,gold,.09,-.24,0,group);}root.add(group);return {...i,mesh:group,taken:false,offset:j};});
  const exitmat=mat(0x9fc8a4,{emissive:0x294f34}),exitGroup=new THREE.Group();exitGroup.position.set(roof.door[0]*CELL,ROOF_Y,roof.door[1]*CELL);box(1.9,.12,1.9,mat(0x617b59),0,.02,0,exitGroup);box(.2,2.6,.25,exitmat,-.86,1.3,0,exitGroup);box(.2,2.6,.25,exitmat,.86,1.3,0,exitGroup);box(1.9,.2,.25,exitmat,0,2.6,0,exitGroup);const door=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.35),new THREE.MeshBasicMaterial({color:0x75bb91,transparent:true,opacity:.38,side:THREE.DoubleSide}));door.position.y=1.3;exitGroup.add(door);root.add(exitGroup);exitObject={group:exitGroup,door};exitGroup.visible=false;
  buildLadderAndRails();
  enemies=data.enemies.map((e,i)=>{const g=voxelActor(i%2?0xa799cc:0x8ab879);g.position.set(e.cell[0]*CELL,0,e.cell[1]*CELL);root.add(g);return {mesh:g,cell:[...e.cell],target:null,hp:2,alive:true,step:i,stun:0};});
  markers=[];hintMeshes=[];collected=keysFound=defeated=elapsed=walkDistance=0;health=3;lastAttack=-10;invulnerable=0;hintUntil=0;spawn();setupHand();
  if(dark)root.traverse(o=>{if(o.isMesh){o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.emissive)m.emissive.set(0x000000);}});
  effects=createEffects(root,data.grid,camera);night=createNightWorld({level:data,root,camera,hand});night.update(0);updateHUD();}
function spawn(){camera.position.set(data.start[0]*CELL,1.55,data.start[1]*CELL);const next=neighbors(data.grid,data.start)[0]||[data.start[0],data.start[1]+1];yaw=Math.atan2(-(next[0]-data.start[0]),-(next[1]-data.start[1]));pitch=0;camera.rotation.set(pitch,yaw,0,'YXZ');}
function cellOf(obj=camera){return [Math.round(obj.position.x/CELL),Math.round(obj.position.z/CELL)];}
function clearLine(a,b){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(d/.25);for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(data.grid[Math.round(z/CELL)]?.[Math.round(x/CELL)]!==0)return false;}return true;}
function free(x,z){return canOccupy(phase==='roof'?roof.walkGrid:data.grid,x,z);}
function ready(){return collected>=data.gems&&keysFound>=data.keys&&defeated>=data.defeat;}
function updateHUD(){$('#chapter').textContent=data.index<0?'我的迷宫':`第 ${String(data.index+1).padStart(2,'0')} 关 / 共 10 关`;$('#level-title').textContent=data.name;$('#objectives').innerHTML=`<div class="objective ${collected===data.gems?'complete':''}">◆ 光晶 ${collected}/${data.gems}</div>`+(data.keys?`<div class="objective ${keysFound===data.keys?'complete':''}">⚿ 钥匙 ${keysFound}/${data.keys}</div>`:'')+(data.defeat?`<div class="objective ${defeated>=data.defeat?'complete':''}">✦ 击退 ${Math.min(defeated,data.defeat)}/${data.defeat}</div>`:'');const ns=night?.snapshot();if(ns?.enabled)$('#objectives').insertAdjacentHTML('beforeend','<div class="objective fire-status">'+(ns.hasFire?'✦ 火把 '+ns.lit+'/'+ns.torches.length:'✦ 寻找火种')+'</div>');$('#hearts').textContent=data.npcs?'♥'.repeat(health)+'♡'.repeat(3-health):'这一关没有怪物';$('#hearts').style.fontSize=data.npcs?'22px':'12px';$('#hearts').style.letterSpacing=data.npcs?'7px':'1px';$('#attack').hidden=!data.npcs||phase!=='ground';$('#mission').textContent=phase==='roof'?(ready()?'沿墙顶走到发光的门，就过关了！':'找到出口了！任务还没做完，回梯子按 E 下去。'):phase==='climbing'||phase==='descending'?'扶好梯子，正在'+(phase==='climbing'?'爬上墙顶……':'回到迷宫……'):ready()?'收集完成！找到金色梯子，靠近后按 E 爬上墙。':data.brief;if(night?.enabled&&phase==='ground'){const ns=night.snapshot();$('#mission').textContent=ns.hasFire?'带着火种探索，靠近未点燃的火把按 E；点亮后会一直照着这段路。 '+(ready()?'任务完成，去找梯子！':data.brief):'第五关起进入黑暗：先循着微光找到小火堆，靠近按 E 取火种。';}updateLadderPrompt();if(exitObject)exitObject.door.material.color.set(ready()?0xc2ff80:0x75bb91);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');toastUntil=clock+3.5;}
function capture(){if(!matchMedia('(pointer:coarse)').matches){try{const p=renderer.domElement.requestPointerLock();p?.catch(()=>toast('按住画面拖动，也能转动视角。'));}catch{toast('按住画面拖动，也能转动视角。');}}}
function begin(){build(custom||generateLevel(selected));state='playing';sound.setActive(true);$('#menu').hidden=true;$('#brand').hidden=true;$('#hud').hidden=false;$('#dialog').hidden=true;document.body.classList.add('playing');hand.visible=true;capture();tone(380);toast(data.index===0?'向前走，转个弯。靠近光晶就能收集！':data.brief);}
function resume(){state='playing';sound.setActive(true);$('#dialog').hidden=true;capture();}
function modal(kicker,title,copy,buttons){sound.setActive(false);$('#dialog-kicker').textContent=kicker;$('#dialog-title').textContent=title;$('#dialog-copy').textContent=copy;$('#dialog-actions').replaceChildren();buttons.forEach(([label,fn],i)=>{const b=document.createElement('button');b.className=i?'secondary':'primary';b.textContent=label;b.onclick=fn;$('#dialog-actions').append(b);});$('#dialog').hidden=false;pressed.clear();document.exitPointerLock?.();}
function pause(){if(state!=='playing')return;state='paused';modal('暂停','游戏暂停了','WASD：前后左右移动　方向键：前后与转身\n鼠标：看向四周　F：放路标　H：找附近目标\nE：取火种 / 点亮火把 / 上下梯子　空格 / 点击画面：光杖（有怪物的关卡）\n触屏：左下方向按钮移动，拖动画面转头。',[['继续玩',resume],['重新开始这一关',begin],['选关卡',toMenu]]);}
function toMenu(){state='menu';sound.setActive(false);$('#dialog').hidden=true;$('#hud').hidden=true;$('#menu').hidden=false;$('#brand').hidden=false;document.body.classList.remove('playing');hand.visible=false;renderLevels();}
function win(){if(state!=='playing'||phase!=='roof'||!ready()||distanceToCell(roof.door)>=1)return;state='won';sound.cue('win');effects.win();if(data.index>=0){unlocked=Math.max(unlocked,Math.min(10,data.index+2));try{localStorage.setItem('paper-maze-progress-v1',String(unlocked));}catch{}}const buttons=[];if(data.index>=0&&data.index<9)buttons.push(['下一关 · '+LEVELS[data.index+1].name,()=>{selected=data.index+1;begin();}]);else buttons.push(['再玩一次',begin]);buttons.push(['选关卡',toMenu],['我也来设计一关',()=>location.href='editor.html']);modal('完成',data.index===9?'10关都完成了！':'过关了！',`收集到 ${collected} 颗光晶${keysFound?`、${keysFound} 把钥匙`:''}，用了 ${Math.floor(elapsed/60)} 分 ${Math.floor(elapsed%60)} 秒。\n你想再玩一次，还是画自己的迷宫？`,buttons);}
function interact(){
  if(phase==='climbing'||phase==='descending')return;
  if(phase==='ground')for(const i of items)if(!i.taken&&camera.position.distanceTo(i.mesh.position)<1.35){
    i.taken=true;effects.pickup(i.mesh.position,i.type);i.mesh.visible=false;if(i.type==='gem'){collected++;sound.cue('collect');toast('发现一颗光晶！'+collected+' / '+data.gems);}else{keysFound++;sound.cue('key');toast('找到金钥匙了！');}updateHUD();
  }
  if(phase==='roof'&&distanceToCell(roof.door)<1){
    if(ready())win();else if(clock>toastUntil)toast('任务还没做完，请看看上面的进度。回梯子按 E 下去。');
  }
  updateLadderPrompt();
}
function attack(){if(state!=='playing'||phase!=='ground'||!data.npcs||clock-lastAttack<.6)return;lastAttack=clock;let hit=false,finished=false;const dir=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));for(const e of enemies)if(e.alive){const v=e.mesh.position.clone().sub(camera.position);v.y=0;const d=v.length();if(d<4.6&&v.normalize().dot(dir)>.78&&clearLine(camera.position,e.mesh.position)){e.hp--;e.stun=clock+.8;hit=true;if(e.hp<=0){finished=true;effects.npc(e.mesh);e.alive=false;e.mesh.visible=false;defeated++;toast('哗啦！守路怪散成了彩色积木！');updateHUD();}else toast('打中了！再打一次就能击退。');break;}}sound.cue(finished?'defeat':hit?'hit':'swing');if(!hit)toast('光杖：靠近一点，对准前面的守路怪。');}
function mark(){if(state!=='playing'||climb)return;const cell=cellOf();if(markers.some(m=>m.phase===phase&&cellKey(m.cell)===cellKey(cell))){toast('这里已经有你的路标。');return;}if(markers.length>=24){toast('24 块路标都用完了，还可以使用萤火提示。');return;}const g=new THREE.Group();box(.5,.08,.5,mat(0xe7b963),0,.025,0,g);box(.07,.5,.07,mat(0xad8248),0,.26,0,g);box(.3,.2,.035,mat(SKINS[skin].color),.12,.46,0,g);g.position.set(cell[0]*CELL+.65,phase==='roof'?ROOF_Y:0,cell[1]*CELL+.65);root.add(g);markers.push({cell,mesh:g,phase});toast('路标放好了，下次走到这里就能认出来。');}
function hint(){if(state!=='playing'||climb)return;if(clock<hintUntil){toast('提示还没准备好，再等几秒。');return;}hintMeshes.forEach(m=>{root.remove(m);m.geometry.dispose();m.material.dispose();});const ns=night.snapshot(),start=cellOf(),goals=phase==='ground'&&ns.enabled&&!ns.hasFire?[ns.source]:phase==='roof'?[ready()?roof.door:roof.landing]:items.filter(i=>!i.taken).map(i=>i.cell);if(!goals.length&&defeated<data.defeat)goals.push(...enemies.filter(e=>e.alive).map(e=>cellOf(e.mesh)));if(!goals.length)goals.push(data.exit);const paths=goals.map(g=>findPath(phase==='roof'?roof.walkGrid:data.grid,start,g)).filter(p=>p.length).sort((a,b)=>a.length-b.length),path=paths[0];if(!path)return;hintMeshes=path.slice(1,5).map(([x,z])=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.12),new THREE.MeshBasicMaterial({color:0xeeff94}));m.position.set(x*CELL,(phase==='roof'?ROOF_Y:0)+.18,z*CELL);root.add(m);return m;});hintUntil=clock+9;toast('跟着眼前的萤火走几步。它会带你靠近一个目标。');}
function moveEnemies(dt){if(phase!=='ground')return;for(const e of enemies){if(!e.alive||clock<e.stun)continue;const pos=e.mesh.position;if(!e.target){const c=cellOf(e.mesh);const playerCell=cellOf();if(pos.distanceTo(camera.position)<12&&clearLine(pos,camera.position)){const path=findPath(data.grid,c,playerCell);e.target=path[1]||null;}if(!e.target){const choices=neighbors(data.grid,c);e.target=choices[(e.step++)%choices.length];}}if(e.target){const tx=e.target[0]*CELL,tz=e.target[1]*CELL,dx=tx-pos.x,dz=tz-pos.z,d=Math.hypot(dx,dz),step=dt*(1.1+Math.max(0,data.index)*.045);if(d<=step){pos.x=tx;pos.z=tz;e.target=null;}else{pos.x+=dx/d*step;pos.z+=dz/d*step;e.mesh.rotation.y=Math.atan2(dx,dz);}}if(clock>invulnerable&&pos.distanceTo(camera.position)<1.75){health--;invulnerable=clock+4;updateHUD();tone(160);if(health<=0){state='lost';modal('本次结束','再试一次','三颗心用完了。可以重新开始，等怪物走过去再前进。',[['再试一次',begin],['选关卡',toMenu]]);return;}spawn();toast('碰到守路怪了，回到起点。已经拿到的物品还在。');}}}
function renderLevels(){const freeChoice=$('#practice').checked;$('#levels').replaceChildren();LEVELS.forEach((l,i)=>{const b=document.createElement('button');b.className=`level ${i===selected?'selected':''} ${i<unlocked-1?'done':''}`;b.textContent=String(i+1).padStart(2,'0');b.disabled=!!custom||(!freeChoice&&i>=unlocked);b.title=`第 ${i+1} 关 · ${l.name}${b.disabled?'（通关前一关后开启）':''}`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(i===selected));b.onclick=()=>{selected=i;build(generateLevel(i));renderLevels();};$('#levels').append(b);});const d=custom||LEVELS[selected];$('#level-description').replaceChildren();const strong=document.createElement('strong');strong.textContent=d.name;$('#level-description').append(strong,document.createTextNode(d.brief));}
SKINS.forEach((s,i)=>{const b=document.createElement('button');b.className='character';b.dataset.character=s.id;b.title=s.name+' · '+s.sub;b.setAttribute('aria-label',s.name);b.setAttribute('aria-pressed',String(i===skin));b.innerHTML=`<img class="portrait" src="${portrait(s)}" alt=""><span><b>${s.name}</b><small>${s.sub}</small></span>`;b.onclick=()=>{skin=i;document.querySelectorAll('.character').forEach((x,j)=>x.setAttribute('aria-pressed',String(j===i)));setupHand();};$('#characters').append(b);});
$('#practice').onchange=()=>{if(!$('#practice').checked&&selected>=unlocked){selected=unlocked-1;build(generateLevel(selected));}renderLevels();};$('#start').onclick=begin;$('#pause').onclick=pause;$('#mark').onclick=mark;$('#hint').onclick=hint;$('#attack').onclick=attack;$('#ladder').onclick=useLadder;$('#ignite').onclick=ignite;
document.addEventListener('keydown',e=>{if(state==='playing'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'){pause();return;}if(state!=='playing')return;pressed.add(e.code);if(!e.repeat){if(e.code==='Space')attack();if(e.code==='KeyF')mark();if(e.code==='KeyH')hint();if(e.code==='KeyE')useNearby();}});document.addEventListener('keyup',e=>pressed.delete(e.code));window.addEventListener('blur',()=>{pressed.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing')pause();});
let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(state!=='playing')return;if(document.pointerLockElement){attack();return;}drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)drag=null;});renderer.domElement.addEventListener('pointercancel',()=>drag=null);
document.addEventListener('pointermove',e=>{if(state!=='playing')return;let dx=0,dy=0;if(document.pointerLockElement){dx=e.movementX;dy=e.movementY;}else if(drag?.id===e.pointerId){dx=e.clientX-drag.x;dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;}yaw-=dx*.0025;pitch=Math.max(-.9,Math.min(.9,pitch-dy*.0025));});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pressed.add(b.dataset.key);};const release=()=>pressed.delete(b.dataset.key);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
build(custom||generateLevel(0));renderLevels();let last=performance.now();
function frame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;
  if(state==='playing'){
    elapsed+=dt;night.update(dt);effects.update(dt);
    if(climb)advanceClimb(dt);else {
    const turn=(pressed.has('ArrowLeft')?1:0)-(pressed.has('ArrowRight')?1:0);yaw+=turn*1.9*dt;
    const f=(pressed.has('KeyW')||pressed.has('ArrowUp')?1:0)-(pressed.has('KeyS')||pressed.has('ArrowDown')?1:0);
    const s=(pressed.has('KeyD')?1:0)-(pressed.has('KeyA')?1:0),len=Math.hypot(f,s)||1;
    movePlayer((-Math.sin(yaw)*f+Math.cos(yaw)*s)/len*5.6*dt,(-Math.cos(yaw)*f-Math.sin(yaw)*s)/len*5.6*dt);
    camera.rotation.set(pitch,yaw,0,'YXZ');
    hand.rotation.x=clock-lastAttack<.25?-Math.sin((clock-lastAttack)*Math.PI/.25)*.55:0;
    interact();if(state==='playing')moveEnemies(dt);
    updateHandPose();
    }
  }
  if(state==='won')effects.update(dt);
  for(const i of items)if(!i.taken){i.mesh.rotation.y=clock*.8;i.mesh.position.y=1+Math.sin(clock*2+i.offset)*.09;}
  if(clock>hintUntil-3)hintMeshes.forEach(m=>m.visible=false);
  if(clock>toastUntil)$('#toast').classList.remove('visible');
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// 仅显式测试 URL 暴露状态控制；正常课堂入口不含这些能力。
if(params.get('test')==='1')window.__maze={load(i){selected=i;custom=null;begin();},snapshot(){return {state,phase,roof,night:night.snapshot(),effects:effects.snapshot(),lighting:{ambient:ambient.intensity,sun:sun.intensity,background:scene.background.getHexString()},doorVisible:exitObject.group.visible,height:camera.position.y,data,health,collected,keysFound,defeated,ready:ready(),position:cellOf(),enemies:enemies.map(e=>({alive:e.alive,hp:e.hp,cell:cellOf(e.mesh)}))};},teleport(p){if(!free(p[0]*CELL,p[1]*CELL))throw Error('测试位置在墙内');camera.position.set(p[0]*CELL,EYE_HEIGHT+(phase==='roof'?ROOF_Y:0),p[1]*CELL);},tick:interact,attack,aimAt(p){yaw=Math.atan2(-(p[0]*CELL-camera.position.x),-(p[1]*CELL-camera.position.z));},advance(t=1){clock+=t;},enemyAt(i,p){const e=enemies[i];e.mesh.position.set(p[0]*CELL,0,p[1]*CELL);e.target=null;},npcTick:moveEnemies,sound:()=>sound.inspect(),ignite,effectsTick(dt){if(state==='playing'||state==='won'){effects.update(dt);night.update(dt);}},useLadder,climbTick:advanceClimb,free,win,pause,resume};

// 营地的真实 3D 角色预览，进入关卡后隐藏；不显示地图或玩家身后的景象。
if(params.get('test')==='1')Object.assign(window.__maze,{
  place({x,z,heading=0,look=0}){if(!free(x,z))throw Error('测试位置在墙内');camera.position.set(x,EYE_HEIGHT+(phase==='roof'?ROOF_Y:0),z);yaw=heading;pitch=look;camera.rotation.set(pitch,yaw,0,'YXZ');updateHandPose();},
  move(dx,dz){movePlayer(dx,dz);updateHandPose();},
  setSwing(angle){hand.rotation.x=angle;updateHandPose();},
  character(){return {id:SKINS[skin].id,preview:previewActor?.name,handColor:hand.children[1].material.color.getHexString()};},
  worldTheme(){return {id:data.theme,sky:scene.background.getHexString(),fog:scene.fog.color.getHexString(),cap:root.children.find(o=>o.isInstancedMesh&&!o.material.map)?.material.color.getHexString()};},
  inspectCollision(){camera.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(hand),overlap=[];for(let z=0;z<data.grid.length;z++)for(let x=0;x<data.grid[z].length;x++)if(data.grid[z][x]){const wall=new THREE.Box3(new THREE.Vector3(x*CELL-CELL/2,0,z*CELL-CELL/2),new THREE.Vector3(x*CELL+CELL/2,3.6,z*CELL+CELL/2));if(bounds.intersectsBox(wall))overlap.push([x,z]);}return {position:{x:camera.position.x,z:camera.position.z},bodyFree:free(camera.position.x,camera.position.z),handWalls:overlap,handBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};}
});
const previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.outputColorSpace=THREE.SRGBColorSpace;$('#companion').append(previewRenderer.domElement);
const previewScene=new THREE.Scene(),previewCamera=new THREE.PerspectiveCamera(32,1,.1,30);previewCamera.position.set(3,2.5,5);previewCamera.lookAt(0,.9,0);previewScene.add(new THREE.HemisphereLight(0xfff6dd,0x446344,2.8));const previewLight=new THREE.DirectionalLight(0xffefca,2);previewLight.position.set(-2,5,4);previewScene.add(previewLight);let previewActor,shownSkin=-1;
const podium=new THREE.Mesh(new THREE.CylinderGeometry(.94,1.08,.16,8),mat(0x718e53));podium.position.y=-.08;previewScene.add(podium);
function updateCompanion(){if(previewActor){previewScene.remove(previewActor);disposeTree(previewActor);}previewActor=createCharacter(SKINS[skin]);previewScene.add(previewActor);shownSkin=skin;}
let previewWidth=0;function renderCompanion(){if(state==='menu'&&innerWidth>=1200){if(shownSkin!==skin)updateCompanion();const bounds=$('#companion').getBoundingClientRect();if(previewWidth!==bounds.width){previewWidth=bounds.width;previewRenderer.setSize(bounds.width,bounds.height);previewCamera.aspect=bounds.width/bounds.height;previewCamera.updateProjectionMatrix();}previewRenderer.render(previewScene,previewCamera);}requestAnimationFrame(renderCompanion);}renderCompanion();
