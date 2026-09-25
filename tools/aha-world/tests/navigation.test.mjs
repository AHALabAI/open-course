import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setNavigation,sourceBlocked,nearestWalkable,LANDINGS,BEACON,WATER} from '../public/navigation.mjs';
import {FISHING_PORTAL} from '../public/portal-quest.mjs';
const data=JSON.parse(await readFile(new URL('../public/assets/navigation.json',import.meta.url),'utf8'));
setNavigation(data);
test('all floors expose valid landings and block the open atrium',()=>{
 for(let f=0;f<4;f++){
  const p=LANDINGS[f];assert.equal(sourceBlocked(p.x,p.z,f),false,`landing ${f}`);
  if(f)assert.equal(sourceBlocked(0,0,f),true,`atrium ${f}`);
 }
 assert.equal(sourceBlocked(12,.7,0),true,'pond water is not walkable');
});
test('walking routes reach every critical task and upper-floor crystal',()=>{
 const tasks=[[[0,8.8],[3,10],[WATER.x,WATER.z],[18,7],[-15,13]],
 [[-7,2]],[[0,2]],[[6,1],[BEACON.x,BEACON.z],[FISHING_PORTAL.rod.x,FISHING_PORTAL.rod.z]]];
 for(let f=0;f<4;f++){
  const step=.2,start=LANDINGS[f],queue=[[Math.round(start.x/step),Math.round(start.z/step)]],visited=new Set(queue.map(p=>p.join(',')));
  for(let n=0;n<queue.length;n++){
   const [x,z]=queue[n];
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const a=x+dx,b=z+dz,key=`${a},${b}`;
    if(visited.has(key)||Math.abs(a)>125||Math.abs(b)>125||sourceBlocked(a*step,b*step,f))continue;
    visited.add(key);queue.push([a,b]);
   }
  }
  for(const [x,z] of tasks[f]){
   const p=nearestWalkable(x,z,f);
   assert.ok(queue.some(([a,b])=>Math.hypot(a*step-p.x,b*step-p.z)<.35),`unreachable floor ${f}: ${x},${z}`);
  }
 }
});
