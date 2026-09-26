import * as THREE from './vendor/three.module.js';
import {planNight,lineClear} from './night-plan.mjs';
export function createNightWorld({level,root,camera,hand}){
  const plan=planNight(level),fixtures=[],lights=[],targets=[];let hasFire=false,time=0;
  if(!plan.enabled)return {enabled:false,update(){},nearby(){return null;},interact(){return null;},snapshot(){return {...plan,hasFire:false,lit:0};},dispose(){}};
  const wood=new THREE.MeshLambertMaterial({color:0x815334}),stone=new THREE.MeshLambertMaterial({color:0x5c6470});
  function cube(w,h,d,material,x,y,z,parent){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;}
  function flame(parent){
    const g=new THREE.Group();cube(.24,.42,.24,new THREE.MeshBasicMaterial({color:0xff8a28}),0,.12,0,g);
    cube(.13,.29,.13,new THREE.MeshBasicMaterial({color:0xffe797}),0,.16,-.035,g);
    cube(.11,.16,.11,new THREE.MeshBasicMaterial({color:0xffb443}),.055,.4,0,g);parent.add(g);return g;
  }
  [plan.source,...plan.torches].forEach((cell,i)=>{
    const g=new THREE.Group(),[x,z]=cell;g.position.set(x*3,0,z*3);root.add(g);
    const side=[[1,0],[-1,0],[0,1],[0,-1]].find(([a,b])=>level.grid[z+b]?.[x+a]===1)||[0,0];
    const ox=i?side[0]*1.12:0,oz=i?side[1]*1.12:0,height=i?1.85:.8;
    if(i){cube(.15,.9,.15,wood,ox,1.43,oz,g);cube(.26,.16,.26,stone,ox,1.83,oz,g);}
    else {cube(.95,.22,.95,stone,0,.11,0,g);for(const offset of [-.2,.2])cube(.18,.24,.7,wood,offset,.34,0,g);cube(.4,.15,.4,stone,0,.55,0,g);}
    const fire=flame(g);fire.position.set(ox,height,oz);fire.visible=i===0;
    fixtures.push({cell,source:i===0,lit:i===0,fire,position:new THREE.Vector3(x*3+ox*.78,height+.4,z*3+oz*.78)});
  });
  const held=new THREE.Group();cube(.12,.65,.12,wood,-.9,-.3,-.8,held);const heldFlame=flame(held);heldFlame.position.set(-.9,.12,-.8);held.visible=false;hand.add(held);
  // One short headlight. With no ambient or sunlight, unlit surfaces stay black.
  const beam=new THREE.SpotLight(0xdbeaff,13,5.7,.69,.65,1.6);
  beam.position.set(0,.12,.04);const target=new THREE.Object3D();target.position.set(0,-.4,-4);camera.add(beam,target);beam.target=target;
  beam.castShadow=true;beam.shadow.mapSize.set(512,512);beam.shadow.camera.near=.08;beam.shadow.bias=-.0004;beam.shadow.normalBias=.015;
  lights.push(beam);targets.push(target);
  const handLight=new THREE.PointLight(0xffd1a0,.27,1.45,1.5);camera.add(handLight);lights.push(handLight);
  // Fixed-size shadow-light pool, independent of the number of torches already lit.
  const pool=Array.from({length:3},()=>{
    const light=new THREE.PointLight(0xffb35d,0,10.5,1.7);light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.camera.near=.12;light.shadow.bias=-.0005;light.shadow.normalBias=.025;root.add(light);lights.push(light);return light;
  });
  function nearby(phase){
    if(phase!=='ground')return null;
    return fixtures.filter(f=>f.source?!hasFire:!f.lit).map(f=>({f,d:Math.hypot(camera.position.x-f.cell[0]*3,camera.position.z-f.cell[1]*3)}))
      .filter(({f,d})=>d<1.65&&lineClear(level.grid,camera.position,{x:f.cell[0]*3,z:f.cell[1]*3})).sort((a,b)=>a.d-b.d)[0]?.f||null;
  }
  function update(dt){
    time+=dt;held.visible=hasFire;
    beam.color.set(hasFire?0xffdb94:0xdbeaff);beam.distance=hasFire?7.2:5.7;beam.intensity=hasFire?19:13;
    const near=fixtures.filter(f=>f.lit&&f.position.distanceTo(camera.position)<16).sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position)).slice(0,pool.length);
    pool.forEach((light,i)=>{const f=near[i];light.intensity=f?(f.source?24:32)*(1+.035*Math.sin(time*8+i)):0;if(f)light.position.copy(f.position);});
    fixtures.forEach((f,i)=>{if(f.lit){f.fire.scale.y=1+.08*Math.sin(time*7+i*2);f.fire.rotation.y=time*.6+i;}});
    heldFlame.scale.y=1+.07*Math.sin(time*8);
  }
  return {
    enabled:true,update,nearby,
    interact(phase){
      const f=nearby(phase);if(!f)return null;
      if(f.source){hasFire=true;update(0);return {kind:'source',message:'找到火种了！带着它靠近火把，按 E 逐一点亮。',position:f.position.clone()};}
      if(!hasFire)return {kind:'missing',message:'这支火把还没点亮。先寻找燃烧的小火堆，按 E 取火种。'};
      f.lit=true;f.fire.visible=true;update(0);
      return {kind:'torch',message:'点亮一支火把！这段路会一直亮着。',position:f.position.clone()};
    },
    snapshot(){return {...plan,hasFire,lit:fixtures.filter(f=>!f.source&&f.lit).length,fixtures:fixtures.map(f=>({cell:f.cell,source:f.source,lit:f.lit})),beamDistance:beam.distance,activeLights:pool.filter(l=>l.intensity>0).length,shadows:beam.castShadow&&pool.every(l=>l.castShadow)};},
    dispose(){for(const l of lights){l.removeFromParent();l.shadow?.map?.dispose();l.shadow?.mapPass?.dispose();}for(const t of targets)t.removeFromParent();held.removeFromParent();held.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==wood)o.material.dispose();});wood.dispose();stone.dispose();}
  };
}
