import * as THREE from 'three';

// The rod is on the observatory terrace; the fish is in the garden pond.
export const FISHING_PORTAL={id:'pond-fishing',url:'/mini-game.html?theme=pond',rod:{x:7,z:-.9,floor:3},fish:{x:11.95,z:.65,floor:0},bank:{x:12,z:2.8,floor:0}};
export function createFishingQuest({scene,player,active,groundY,audio,toast,setPaused}){
 let hasRod=false,away=false,initialized=false;
 const rod=new THREE.Group(),fish=new THREE.Group();rod.name='Quest_FishingRod';fish.name='Portal_PondFish';scene.add(rod,fish);
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.65});
 function mesh(geometry,mat,parent){const m=new THREE.Mesh(geometry,mat);parent.add(m);return m;}
 const shaft=mesh(new THREE.CylinderGeometry(.025,.045,1.2,8),material('#bb8349'),rod);shaft.position.y=.7;shaft.rotation.z=-.2;
 const reel=mesh(new THREE.TorusGeometry(.1,.025,6,12),material('#365d64'),rod);reel.position.set(0,.36,0);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.12,1.3,0),new THREE.Vector3(.4,.3,0)]),new THREE.LineBasicMaterial({color:'#e6f9ff'}));rod.add(line);
 const float=mesh(new THREE.SphereGeometry(.06,8,6),material('#fa7750'),rod);float.position.set(.4,.3,0);
 const body=mesh(new THREE.SphereGeometry(.23,12,8),material('#ffad45'),fish);body.scale.set(1.8,.55,.8);
 const tail=mesh(new THREE.ConeGeometry(.19,.32,3),material('#e97835'),fish);tail.rotation.z=Math.PI/2;tail.position.x=-.5;
 for(const z of [-.15,.15]){const eye=mesh(new THREE.SphereGeometry(.035,8,6),material('#172e30'),fish);eye.position.set(.26,.05,z);}
 // Larger transparent hit targets help touch users without a visible portal sign.
 for(const [group,r] of [[rod,.55],[fish,.65]]){const hit=mesh(new THREE.SphereGeometry(r,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),group);hit.position.y=group===rod?.6:0;}
 const task=document.createElement('p');task.id='fishingQuest';document.getElementById('quest3').after(task);
 const modal=document.createElement('dialog');modal.id='fishingPortal';modal.innerHTML='<h2>水池里的秘密</h2><p>鱼竿已就绪。进入钓鱼小游戏？</p><p>将在新标签页打开，AHA 当前玩家暂停，伙伴继续游戏。回来后点击“返回 AHA”继续。</p><a id="enterFishing" target="_blank" rel="noopener noreferrer">进入钓鱼小游戏 ↗</a><button id="returnFishing">返回 AHA</button><small>如果新页面未打开，可再次点击入口。</small>';document.body.append(modal);
 const style=document.createElement('style');style.textContent='#fishingPortal{max-width:min(440px,calc(100vw - 32px));border:0;border-radius:20px;padding:24px;background:#f6f8ed;color:#173e33}#fishingPortal::backdrop{background:#173e3380}#fishingPortal a{display:block;padding:14px;background:#226f58;color:white;border-radius:10px;text-align:center;margin:16px 0}#fishingPortal small{display:block;margin-top:12px}#fishingQuest{font-size:12px;color:#266f58}';document.head.append(style);
 const link=modal.querySelector('a');link.href=FISHING_PORTAL.url;
 link.onclick=()=>{audio.play('portal-enter');away=true;setPaused(true);};
 function resume(){modal.close();away=false;setPaused(false);}
 modal.querySelector('button').onclick=resume;
 modal.addEventListener('cancel',e=>{e.preventDefault();if(!away)resume();});
 function near(point,r){return player.floor===point.floor&&Math.hypot(player.x-point.x,player.z-point.z)<=r;}
 function refreshTask(){task.textContent=hasRod?'✓ 鱼竿已获得 · 回一楼凉亭水池边点鱼':'隐藏任务：四楼观测平台找鱼竿 → 水池边点鱼';}
 function use(kind){
  if(!active())return false;
  if(kind==='rod'){
   if(hasRod)return false;
   if(!near(FISHING_PORTAL.rod,1.4)){toast('靠近四楼观测平台里的鱼竿再拾取。');return true;}
   hasRod=true;rod.visible=false;audio.play('portal-unlock');toast('获得鱼竿！回凉亭旁水池，点小鱼试试。');refreshTask();return true;
  }
  if(!near(FISHING_PORTAL.bank,2.2)){toast('先走到凉亭水池边，再点小鱼。');return true;}
  if(!hasRod){toast('小鱼躲开了。去四楼观测平台找一支鱼竿吧。');return true;}
  modal.querySelector('p').textContent='鱼竿已就绪。进入钓鱼小游戏？';modal.showModal();setPaused(true);return true;
 }
 return{
  initialize(){rod.position.set(FISHING_PORTAL.rod.x,groundY(FISHING_PORTAL.rod.x,FISHING_PORTAL.rod.z,3)+.08,FISHING_PORTAL.rod.z);fish.position.set(FISHING_PORTAL.fish.x,.28,FISHING_PORTAL.fish.z);initialized=true;refreshTask();},
  update(time,mode){rod.visible=initialized&&mode!=='intro'&&player.floor===3&&!hasRod;fish.visible=initialized&&mode!=='intro'&&player.floor===0;fish.position.x=FISHING_PORTAL.fish.x+Math.sin(time*.6)*.45;fish.position.z=FISHING_PORTAL.fish.z+Math.cos(time*.6)*.2;fish.rotation.y=-time*.6;},
  click(ray){const groups=[rod,fish].filter(g=>g.visible);const hit=ray.intersectObjects(groups,true)[0];if(!hit)return false;let o=hit.object;while(o.parent&&!groups.includes(o))o=o.parent;return use(o===rod?'rod':'fish');},
  interact(){if(!hasRod&&near(FISHING_PORTAL.rod,1.4))return use('rod');return false;},
  reset(){hasRod=false;away=false;if(modal.open)modal.close();refreshTask();},
  get holdsPause(){return modal.open||away;},
  snapshot:()=>({hasRod,away,dialogOpen:modal.open,rod:{...FISHING_PORTAL.rod},fish:{...FISHING_PORTAL.fish}})
 };
}
