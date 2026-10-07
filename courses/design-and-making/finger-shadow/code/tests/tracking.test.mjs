import test from 'node:test';
import assert from 'node:assert/strict';
import {HandTracker,describeHand,gripIntent} from '../app/core.mjs';
import {handGeometry,updateFacing,palmAppearance,puppetTurn} from '../app/hand-identity.mjs';
const hand=(x,person=0,face=1)=>({x,y:.5,size:.12,handedness:'Left',thumb:.5,pinch:.8,
 fingers:[.8,.9,.7,.8],fist:false,palmFacing:face,
 boneShape:Array.from({length:22},(_,i)=>.6+i*.01+person*(i%3)*.1),
 appearance:Array.from({length:24},(_,i)=>i%8===(person?5:3)?1:0)});
const enroll=(tracker,hands)=>{for(let time=0;time<=600;time+=100)tracker.update(hands,time);};
test('grasp intent accepts three curled fingers, leaves a neutral band, and does not use thumb gain',()=>{
 assert.deepEqual(gripIntent([.25,.2,.25,.65]),{closed:true,open:false});
 assert.deepEqual(gripIntent([.5,.5,.5,.5]),{closed:false,open:false});
 assert.deepEqual(gripIntent([.9,.9,.8,.6]),{closed:false,open:true});
 assert.deepEqual(gripIntent([NaN,.2,.2,.2]),{closed:false,open:false});
 const tracker=new HandTracker(1,{gestureHoldMs:90});enroll(tracker,[hand(.4)]);
 tracker.update([{...hand(.4),fingers:[.2,.2,.2,.2]}],650);assert.equal(tracker.tracks[0].grasping,false);
 tracker.update([{...hand(.4),fingers:[.2,.2,.2,.2]}],750);assert.equal(tracker.tracks[0].grasping,true);
 tracker.update([],800);assert.equal(tracker.tracks[0].grasping,false);assert.equal(tracker.tracks[0].handOpen,false);
});

test('palm normal changes on turning over, not on rotating within the image plane',()=>{
 const p=Array.from({length:21},(_,i)=>({x:i*.01,y:i*.02,z:0}));p[0]={x:0,y:0,z:0};p[5]={x:-.3,y:-1,z:0};p[17]={x:.3,y:-1,z:0};
 const rotateY=angle=>p.map(q=>({x:q.x*Math.cos(angle),y:q.y,z:-q.x*Math.sin(angle)}));
 const front=handGeometry(p).palmFacing,back=handGeometry(rotateY(Math.PI)).palmFacing;
 assert.equal(Math.sign(front),-Math.sign(back));assert(Math.abs(handGeometry(rotateY(Math.PI/2)).palmFacing)<1e-6);
 const inPlane=p.map(q=>({x:-q.y,y:q.x,z:q.z}));assert.equal(handGeometry(inPlane).palmFacing,front);
});
test('flip debounce ignores side-on/jitter and preserves independent reference for each hand',()=>{
 const a={},b={};for(const now of [0,80,160]){updateFacing(a,{palmFacing:.9},now);updateFacing(b,{palmFacing:-.9},now);}
 assert.equal(a.facing,1);assert.equal(b.facing,1);
 updateFacing(a,{palmFacing:-.9},200);updateFacing(a,{palmFacing:.05},280);updateFacing(a,{palmFacing:.9},330);assert.equal(a.facing,1);
 for(const now of [400,500,580])updateFacing(a,{palmFacing:-.9},now);
 assert.equal(a.facing,-1);assert.equal(b.facing,1);
 assert.equal(puppetTurn(a),-1);assert.equal(puppetTurn(a,-1),1);
});
test('three replay rounds recover owners after 30 seconds and opposite-side reentry',()=>{
 for(let round=0;round<3;round++){
  const t=new HandTracker();enroll(t,[hand(.2,0),hand(.8,1)]);const ids=t.tracks.map(t=>t.id);
  t.update([],30000);assert(t.tracks.every(t=>t.state==='dormant'));
  for(const now of [30100,30210]){t.update([hand(.2,1),hand(.8,0)],now);assert(t.tracks.every(t=>t.state==='dormant'));}
  t.update([hand(.8,0),hand(.2,1)],30340);
  assert.deepEqual(t.tracks.map(t=>t.id),ids);assert.deepEqual(t.tracks.map(t=>t.x),[.8,.2]);
  assert(t.tracks.every(t=>t.state==='tracked'&&t.recoveries===1));
 }
});
test('lookalike returns stay unassigned instead of stealing a preserved owner',()=>{
 const t=new HandTracker();enroll(t,[hand(.2),hand(.8)]);const ids=t.tracks.map(t=>t.id);t.update([],20000);
 for(const now of [20100,20220,20350])t.update([hand(.5)],now);
 assert.deepEqual(t.tracks.map(t=>t.id),ids);assert(t.tracks.every(t=>t.state==='dormant'));assert.equal(t.unassigned,1);
});
test('different appearance and short flashes cannot reclaim an owner; manual binding resets profile',()=>{
 const t=new HandTracker();enroll(t,[hand(.2)]);t.update([],12000);
 for(const now of [12100,12220,12350])t.update([hand(.2,1)],now);
 assert.equal(t.tracks.length,1);assert.equal(t.tracks[0].state,'dormant');
 t.update([hand(.8)],12400);assert(t.tracks[0].recovering);t.update([],12450);t.update([hand(.8)],12600);assert.equal(t.tracks[0].state,'dormant');
 const id=t.tracks[0].id;t.bind(hand(.6,1),0,12700);assert.equal(t.tracks[0].id,id);assert.equal(t.tracks[0].state,'tracked');
 assert.equal(t.tracks[0]._identity.positive.samples,1);
});
test('handedness label may flip during continuous 3D observation without changing the role',()=>{
 const t=new HandTracker();enroll(t,[hand(.4)]);const id=t.tracks[0].id;
 for(const now of [650,750,850])t.update([{...hand(.41,0,-1),handedness:'Right'}],now);
 assert.equal(t.tracks.length,1);assert.equal(t.tracks[0].id,id);assert.equal(t.tracks[0].facing,-1);assert.equal(t.tracks[0].state,'tracked');
 t.update([],1100);assert.equal(t.tracks[0].facing,-1);
});
test('inner palm sampling ignores background changes and rejects too few usable pixels',()=>{
 const points=Array.from({length:21},()=>({x:.5,y:.5}));
 [[0,.5,.8],[5,.25,.35],[9,.43,.28],[13,.6,.3],[17,.75,.4]].forEach(([i,x,y])=>points[i]={x,y});
 const pixels=new Uint8ClampedArray(80*80*4);for(let i=0;i<pixels.length;i+=4)pixels.set([180,130,100,255],i);
 const a=palmAppearance(pixels,80,80,points);assert.equal(a.length,24);
 for(let y=0;y<80;y++)for(let x=0;x<10;x++)pixels.set([0,255,0,255],(y*80+x)*4);
 assert.deepEqual(palmAppearance(pixels,80,80,points),a);
 assert.equal(palmAppearance(new Uint8ClampedArray(80*80*4),80,80,points),null);
 assert.equal(describeHand(Array(20).fill({x:0,y:0})),null);
});
