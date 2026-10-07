import test from 'node:test';
import assert from 'node:assert/strict';
import {graspExtensions,graspFeatures} from '../app/grasp.mjs';
import {gripIntent,HandTracker} from '../app/core.mjs';
import {StageScene} from '../app/scene-state.mjs';
function hand(closed){const p=Array.from({length:21},()=>({x:0,y:0,z:0}));for(const [n,i] of [5,9,13,17].entries()){const x=n*.3;p[i]={x,y:0,z:0};p[i+1]={x,y:-.4,z:0};p[i+2]=closed?{x,y:-.4,z:.3}:{x,y:-.7,z:0};p[i+3]=closed?{x,y:-.1,z:.3}:{x,y:-.95,z:0};}return p;}
test('two-joint grasp remains closed on palm, side, back and rotated hands',()=>{for(const a of [0,Math.PI/3,Math.PI/2,Math.PI]){const rotate=p=>p.map(q=>({x:q.x*Math.cos(a)+q.z*Math.sin(a),y:q.y,z:-q.x*Math.sin(a)+q.z*Math.cos(a)}));assert.equal(gripIntent(graspExtensions(rotate(hand(true)))).closed,true);assert.equal(gripIntent(graspExtensions(rotate(hand(false)))).open,true);}});
test('grasp recognition is independent of puppet finger pose values',()=>{const tracker=new HandTracker(1,{gestureHoldMs:90}),h={x:.5,y:.5,size:.12,pinch:.8,fingers:[.8,.8,.8,.8],gripFingers:[.1,.1,.1,.1],fist:false};tracker.update([h],0);tracker.update([h],100);tracker.update([h],210);assert.equal(tracker.tracks[0].grasping,true);assert.equal(tracker.tracks[0].handOpen,false);});
function fixture(){const s=new StageScene();s.clear();const item=s.add('ball');item.x=650;item.y=350;const actor={id:1,slot:0,state:'tracked',grasping:false,handOpen:true,grips:{left:[650,350],right:[450,350]}};s.update([actor],0);return {s,item,actor};}
test('flip switches to the nearer mirrored hand and survives a brief side-on hold',()=>{const {s,item,actor}=fixture();s.update([{...actor,state:'hold'}],100);const flipped={...actor,handOpen:false,grasping:true,facing:-1,grips:{left:[430,390],right:[580,380]}};s.update([flipped],260);s.update([flipped],490);assert.equal(item.owner,'hand-1-slot-0');assert.equal(item.side,'right');assert.equal(item.x,580);s.update([{...flipped,grasping:false,handOpen:true}],550);s.update([{...flipped,grasping:false,handOpen:true}],740);assert.equal(item.owner,null);});
test('long occlusion and faraway fists cannot use stale object contacts',()=>{for(const scenario of ['far','long']){const {s,item,actor}=fixture();if(scenario==='long')s.update([{...actor,state:'lost'}],1500);const closed={...actor,handOpen:false,grasping:true,grips:scenario==='far'?{left:[100,100],right:[200,100]}:actor.grips};s.update([closed],1550);s.update([closed],1780);assert(!item.owner);}});
test('three projected hidden tips close a back-facing fist even when estimated depth is wrong',()=>{
 const world=hand(false),image=hand(false);image[0]={x:.5,y:.9,z:0};for(const [n,i] of [5,9,13,17].entries()){image[i]={x:.35+n*.1,y:.5,z:0};image[i+3]={x:.35+n*.1,y:.64,z:0};}
 assert.equal(gripIntent(graspFeatures(world,image,-.9)).closed,true);
 assert.equal(gripIntent(graspFeatures(world,image,.9)).closed,true);
 assert.equal(gripIntent(graspFeatures(world,image,.1)).open,true);
 assert.equal(gripIntent([.1,.1,.1,null]).closed,true);assert.equal(gripIntent([.1,.1,null,null]).closed,false);
});
test('short flip occlusion can resume an unambiguous local motion track without prior back-face enrollment',()=>{
 const base={x:.5,y:.5,size:.12,pinch:.8,fingers:[.9,.9,.9,.9],fist:false,handedness:'Left',palmFacing:.9,motionId:4,boneShape:Array(22).fill(.7),appearance:Array.from({length:24},(_,i)=>i%8===3?1:0)};
 const tracker=new HandTracker();for(let now=0;now<=600;now+=100)tracker.update([base],now);const id=tracker.tracks[0].id;tracker.update([],1000);
 tracker.update([{...base,palmFacing:-.9,handedness:'Right'}],1200);assert.equal(tracker.tracks[0].state,'tracked');assert.equal(tracker.tracks[0].id,id);assert.equal(tracker.tracks.length,1);
});
