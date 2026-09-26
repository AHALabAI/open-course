import * as THREE from './vendor/three.module.js';
import {moveWithCollisions,canOccupy} from './collision.mjs';
export function createEffects(root,grid,camera){
  const group=new THREE.Group();root.add(group);const cube=new THREE.BoxGeometry(1,1,1),bursts=[],popups=[],confetti=[];
  const overlay=document.createElement('div');overlay.className='reward-effects';overlay.setAttribute('aria-hidden','true');document.body.append(overlay);
  let sequence=0;
  function random(){sequence=(sequence*1664525+1013904223)>>>0;return sequence/4294967296;}
  function burst(position,colors,count,blocks){
    const materials=colors.map(color=>blocks?new THREE.MeshLambertMaterial({color}):new THREE.MeshBasicMaterial({color}));
    const particles=[];
    for(let i=0;i<count;i++){
      const size=blocks?.16+random()*.17:.065+random()*.06,m=new THREE.Mesh(cube,materials[i%materials.length]);
      m.scale.setScalar(size);m.position.copy(position);m.position.y+=blocks?.2+random()*1.3:random()*.2;
      m.position.x+=(random()-.5)*.55;m.position.z+=(random()-.5)*.55;
      if(!canOccupy(grid,m.position.x,m.position.z,.3)){m.position.x=position.x;m.position.z=position.z;}
      const angle=random()*Math.PI*2,speed=blocks?1.2+random()*1.8:1+random()*1.4;
      group.add(m);particles.push({m,size,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,vy:blocks?2.1+random()*2:1.1+random(),spin:(random()-.5)*9});
    }
    let ring=null;if(!blocks){ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.027,4,24),new THREE.MeshBasicMaterial({color:colors[0],transparent:true,opacity:.8}));ring.position.copy(position);group.add(ring);}
    bursts.push({particles,materials,ring,age:0,life:blocks?3.1:1.05,blocks});
    while(bursts.length>7)release(bursts.shift());
  }
  function release(b){for(const p of b.particles)group.remove(p.m);b.materials.forEach(m=>m.dispose());if(b.ring){group.remove(b.ring);b.ring.geometry.dispose();b.ring.material.dispose();}}
  function pop(text){const el=document.createElement('div');el.className='reward-pop';el.textContent=text;overlay.append(el);popups.push({el,age:0});}
  function update(dt){
    dt=Math.min(dt,.06);
    for(let b=bursts.length-1;b>=0;b--){
      const effect=bursts[b];effect.age+=dt;
      if(effect.age>=effect.life){release(effect);bursts.splice(b,1);continue;}
      if(effect.ring){effect.ring.scale.setScalar(1+effect.age*3);effect.ring.material.opacity=Math.max(0,.8-effect.age);effect.ring.quaternion.copy(camera.quaternion);}
      for(const p of effect.particles){
        const {m}=p,oldX=m.position.x,oldZ=m.position.z,next=moveWithCollisions(grid,m.position,p.vx*dt,p.vz*dt,.3);
        if(Math.abs(next.x-(oldX+p.vx*dt))>.001)p.vx*=-.4;
        if(Math.abs(next.z-(oldZ+p.vz*dt))>.001)p.vz*=-.4;
        m.position.x=next.x;m.position.z=next.z;p.vy-=dt*(effect.blocks?7:3.5);m.position.y+=p.vy*dt;
        if(m.position.y<p.size/2){m.position.y=p.size/2;p.vy=Math.abs(p.vy)*.29;p.vx*=.75;p.vz*=.75;}
        m.rotation.x+=p.spin*dt;m.rotation.z+=p.spin*.6*dt;
        m.scale.setScalar(p.size*Math.min(1,(effect.life-effect.age)/(effect.blocks?.65:.4)));
      }
    }
    for(let i=popups.length-1;i>=0;i--){const p=popups[i];p.age+=dt;p.el.style.transform='translate(-50%,'+(-p.age*55)+'px)';p.el.style.opacity=String(Math.min(1,(1.2-p.age)/.35));if(p.age>1.2){p.el.remove();popups.splice(i,1);}}
    for(let i=confetti.length-1;i>=0;i--){const p=confetti[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=dt*45;p.el.style.transform='translate('+p.x+'vw,'+p.y+'vh) rotate('+(p.age*p.spin)+'deg)';p.el.style.opacity=String(Math.min(1,(3.8-p.age)/.8));if(p.age>3.8){p.el.remove();confetti.splice(i,1);}}
  }
  return {
    update,
    npc(enemy){const cloth=enemy.children.find(o=>o.material)?.material.color.getHex()||0x8ab879;burst(enemy.position.clone(),[cloth,0xf1d4a0,0x577d65,0xdacb8b],30,true);},
    pickup(position,type){burst(position.clone(),type==='key'?[0xffe6a0,0xf7b950,0xfff4d0]:[0xffdd71,0xffffc0,0xbee898],16,false);pop(type==='key'?'⚿ 钥匙 +1':'◆ 光晶 +1');},
    fire(position){burst(position.clone(),[0xffb753,0xffedb0,0xf97b30],12,false);pop('✦ 火光亮起来了');},
    win(){
      for(let i=0;i<60;i++){const el=document.createElement('i');el.style.background=['#f8cc6a','#b6df87','#87d7d2','#c7a4eb','#f2a895'][i%5];overlay.append(el);confetti.push({el,x:random()*100,y:-12-random()*26,vx:(random()-.5)*10,vy:12+random()*12,spin:(random()-.5)*400,age:0});}
    },
    snapshot(){return {bursts:bursts.length,blocks:bursts.filter(b=>b.blocks).reduce((n,b)=>n+b.particles.length,0),sparkles:bursts.filter(b=>!b.blocks).reduce((n,b)=>n+b.particles.length,0),popups:popups.length,confetti:confetti.length,particles:bursts.flatMap(b=>b.particles.map(p=>({x:p.m.position.x,y:p.m.position.y,z:p.m.position.z,free:canOccupy(grid,p.m.position.x,p.m.position.z,.3)})))};},
    dispose(){bursts.forEach(release);group.removeFromParent();cube.dispose();overlay.remove();}
  };
}
