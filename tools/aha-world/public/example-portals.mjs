import * as THREE from 'three';
export const EXAMPLE_GAMES=[
 {id:'sea-survival',title:'航标收集',url:'/mini-game.html?theme=sea'},
 {id:'vemork-raid',title:'信号寻踪',url:'/mini-game.html?theme=signal'}
];
export const SENTRY_HOME={x:18,z:7,floor:0};
export function createExamplePortals({scene,player,state,active,groundY,audio,toast,setPaused}){
 let initialized=false,seaUnlocked=false,hp=3,hasOrder=false,away=false,selected=null,patrol=0;
 const objects={},mat=color=>new THREE.MeshStandardMaterial({color,roughness:.55});
 const steel=mat('#53717b'),gold=mat('#ffb35b'),dark=mat('#203c46'),paper=mat('#fff0cc');
 function group(name){const g=new THREE.Group();g.name=name;g.visible=false;scene.add(g);objects[name]=g;return g;}
 function box(parent,size,pos,material){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);parent.add(m);return m;}
 function target(parent,r){const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));m.position.y=.55;parent.add(m);}
 const fire=group('Sea_FireTrigger');target(fire,.8);
 const boat=group('Sea_Sailboat');box(boat,[.8,.18,.36],[0,.3,0],gold);box(boat,[.045,.7,.045],[0,.7,0],dark);
 const sail=new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.04,.42,0),new THREE.Vector3(.04,1.03,0),new THREE.Vector3(.45,.42,0)]),new THREE.MeshStandardMaterial({color:'#fff0cc',side:THREE.DoubleSide}));boat.add(sail);target(boat,.65);
 const dog=group('Raid_MechanicalSentry');box(dog,[.65,.35,.9],[0,.55,0],steel);box(dog,[.46,.36,.38],[0,.78,.5],steel);box(dog,[.38,.1,.04],[0,.8,.71],gold);
 for(const x of [-.22,.22])for(const z of [-.3,.3])box(dog,[.13,.38,.15],[x,.2,z],dark);
 for(const x of [-.16,.16])box(dog,[.09,.2,.12],[x,1,.5],gold);const antenna=box(dog,[.07,.35,.08],[0,.75,-.5],gold);antenna.rotation.x=-.45;target(dog,.7);
 const order=group('Raid_ActionOrder');box(order,[.45,.07,.32],[0,.3,0],paper);box(order,[.12,.08,.12],[0,.34,0],gold);target(order,.6);
 const task=document.createElement('p');task.id='studentQuest';document.getElementById('quest3').after(task);
 const modal=document.createElement('dialog');modal.id='studentPortal';modal.innerHTML='<h2></h2><p></p><p>将在新标签页打开。当前玩家暂停，伙伴继续；回来后点击“返回 AHA”。</p><a id="enterStudentGame" target="_blank" rel="noopener noreferrer"></a><button id="returnStudentGame">返回 AHA</button><small>若新标签页未打开，可再次点击入口。</small>';document.body.append(modal);
 const style=document.createElement('style');style.textContent='#studentPortal{max-width:min(460px,calc(100vw - 32px));border:0;border-radius:20px;padding:24px;background:#f6f8ed;color:#173e33}#studentPortal::backdrop{background:#173e3380}#studentPortal a{display:block;padding:14px;background:#226f58;color:white;border-radius:10px;margin:16px 0;text-align:center}#studentPortal small{display:block;margin-top:12px}#studentQuest{font-size:12px;color:#266f58}';document.head.append(style);
 const link=modal.querySelector('a');link.onclick=()=>{away=true;setPaused(true);};
 function resume(){modal.close();away=false;setPaused(false);}
 modal.querySelector('button').onclick=resume;modal.addEventListener('cancel',e=>{e.preventDefault();if(!away)resume();});
 function refresh(){task.textContent=`${seaUnlocked?'✓ 帆船已解锁 · 点篝火旁帆船':'○ 点燃篝火，再添 1 木材，寻找海上入口'}；${hasOrder?'✓ 行动密令已获得 · 点密令出发':hp===0?'○ 机械哨犬已停机 · 靠近拾取密令':'○ 东侧巡逻区：击败金色目镜机械哨犬'}`;}
 function near(g,r){return player.floor===0&&Math.hypot(player.x-g.position.x,player.z-g.position.z)<=r;}
 function open(id){selected=EXAMPLE_GAMES.find(g=>g.id===id);modal.querySelector('h2').textContent=selected.title;modal.querySelector('p').textContent=id==='sea-survival'?'篝火里的小帆船，带你驶向海上世界。':'行动密令已确认，准备进入信号寻踪任务。';link.href=selected.url;link.textContent='进入游戏 ↗';modal.showModal();setPaused(true);}
 function fuel(){if(!active())return false;if(!near(fire,2.3)){toast('先靠近庭院篝火。');return true;}if(!state.fire){toast('先点燃篝火，再添 1 份木材寻找秘密。');return true;}if(seaUnlocked){open('sea-survival');return true;}if(state.inventory.wood<1){toast('还需要额外 1 份木材，才能唤出小帆船。');return true;}state.inventory.wood--;seaUnlocked=true;audio.play('portal-unlock');toast('火光中浮现小帆船！点它进入航标收集。');refresh();return true;}
 function hitSentry(){if(!active()||hp<=0||!near(dog,2.5))return false;hp--;audio.play('attack-hit');if(!hp){order.position.copy(dog.position);dog.visible=false;audio.play('portal-unlock');toast('机械哨犬已停机，掉落行动密令。靠近点击或按 E 拾取。');}else toast(`机械哨犬护甲 ${hp}/3 · 再次挥击可拆除护甲`);refresh();return true;}
 function useOrder(){if(!active())return false;if(!near(order,1.8)){toast('靠近行动密令再操作。');return true;}if(!hasOrder){hasOrder=true;audio.play('item-pickup');toast('获得行动密令！再次点击密令，进入信号寻踪。');refresh();}else open('vemork-raid');return true;}
 return{
  initialize(){fire.position.set(3,groundY(3,10,0),10);boat.position.set(3.9,groundY(3.9,10,0),10);dog.position.set(SENTRY_HOME.x,groundY(SENTRY_HOME.x,SENTRY_HOME.z,0),SENTRY_HOME.z);initialized=true;refresh();},
  update(dt,mode){const visible=initialized&&mode!=='intro'&&player.floor===0;fire.visible=visible;boat.visible=visible&&seaUnlocked;dog.visible=visible&&hp>0;order.visible=visible&&hp===0;if(active()&&hp>0){patrol+=dt;dog.position.x=SENTRY_HOME.x+Math.sin(patrol*.7)*.7;dog.position.z=SENTRY_HOME.z+Math.cos(patrol*.7)*.7;dog.position.y=groundY(dog.position.x,dog.position.z,0);dog.rotation.y=patrol*.7;}},
  click(ray){const gs=Object.values(objects).filter(g=>g.visible),hit=ray.intersectObjects(gs,true)[0];if(!hit||!active())return false;let o=hit.object;while(o.parent&&!gs.includes(o))o=o.parent;if(o===dog)return 'sentry';if(o===order){useOrder();return true;}if(o===boat){if(near(boat,2.3))open('sea-survival');else toast('靠近篝火旁的小帆船。');return true;}return fuel();},
  interact(){if(!active())return false;if(hp===0&&near(order,1.8))return useOrder();if(state.fire&&near(fire,2.3))return fuel();return false;},
  hitSentry,
  reset(){seaUnlocked=false;hp=3;hasOrder=false;away=false;selected=null;patrol=0;if(modal.open)modal.close();refresh();},
  get holdsPause(){return modal.open||away;},
  snapshot:()=>({seaUnlocked,sentryHp:hp,hasOrder,away,dialogOpen:modal.open,selected:selected?.id||null,sentry:{x:dog.position.x,z:dog.position.z}})
 };
}
