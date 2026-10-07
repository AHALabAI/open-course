import test from 'node:test';import assert from 'node:assert/strict';
import {HandTracker,describeHand} from '../app/core.mjs';import {ActionController,actionPose} from '../app/actions.mjs';
const hand=(x,handedness='Left')=>({x,y:.5,size:.12,handedness,thumb:.5,pinch:.8,fingers:[1,1,1,1],fist:false,features:[1,1,1,1,.4]});
test('crossing, array reorder and temporary overlap retain fixed left/right owners',()=>{
 const t=new HandTracker(2);t.update([hand(.25),hand(.75,'Right')],0);const ids=t.tracks.map(t=>t.id);
 for(const [time,a,b] of [[100,.35,.65],[200,.44,.56],[260,.49,.51],[330,.55,.45],[430,.65,.35]])t.update([hand(b,'Right'),hand(a)],time);
 assert.deepEqual(t.tracks.map(t=>t.id),ids);assert.ok(t.tracks[0].x>t.tracks[1].x);assert.deepEqual(t.tracks.map(t=>t.slot),[0,1]);
});
test('a one-frame handedness reversal freezes instead of creating a new character',()=>{
 const t=new HandTracker();t.update([hand(.4)],0);const id=t.tracks[0].id;t.update([hand(.41,'Right')],40);assert.equal(t.tracks.length,1);assert.equal(t.tracks[0].state,'hold');t.update([hand(.42)],90);assert.equal(t.tracks[0].id,id);assert.equal(t.tracks[0].state,'tracked');
});
test('four second absence recovers same slot; long absence requires explicit claim',()=>{
 const t=new HandTracker();t.update([hand(.4)],0);const id=t.tracks[0].id;t.update([],4000);t.update([hand(.44)],4050);assert.equal(t.tracks.length,1);assert.equal(t.tracks[0].id,id);assert.equal(t.tracks[0].state,'tracked');t.update([],15000);t.update([hand(.45)],15050);assert.equal(t.tracks.length,1);assert.equal(t.tracks[0].state,'dormant');t.bind(hand(.45),0,15100);assert.equal(t.tracks[0].id,id);assert.equal(t.tracks[0].state,'tracked');
});
test('same-handed ambiguous association freezes and does not spawn substitutes',()=>{const t=new HandTracker();t.update([hand(.35),hand(.65)],0);t.update([hand(.49),hand(.51)],50);assert.equal(t.tracks.length,2);assert.deepEqual(t.tracks.map(t=>t.state),['hold','hold']);assert.deepEqual(t.tracks.map(t=>t.x),[.35,.65]);});
test('five fingers: thumb feature is independent of the other four finger curls',()=>{const p=Array.from({length:21},(_,i)=>({x:.2+i*.02,y:.2+(i%4)*.03,z:0}));p[1]={x:.1,y:.3,z:0};p[2]={x:.15,y:.3,z:0};p[3]={x:.2,y:.3,z:0};p[4]={x:.25,y:.3,z:0};const a=describeHand(p);p[4]={x:.12,y:.31,z:0};const b=describeHand(p);assert.ok(a.thumb>b.thumb+.3);assert.deepEqual(a.fingers,b.fingers);});
test('macros require deliberate hold, release to rearm and per-hand cooldown',()=>{
 const c=new ActionController(),open={id:1,state:'tracked',thumb:.6,fingers:[1,1,1,1]},v={...open,fingers:[1,1,0,0]};
 assert.equal(c.update(v,0,true),null);assert.equal(c.update(v,700,true),null); // no initial open, no trigger
 c.update(open,800,true);c.update(v,850,true);assert.equal(c.update(v,1000,true),null);assert.equal(c.update(v,1310,true).name,'jump');
 assert.equal(c.update(v,2300,true),null);assert.equal(c.update(v,4000,true),null);c.update(open,4100,true);c.update(v,4200,true);assert.equal(c.update(v,4700,true).name,'jump');
 assert.equal(c.update({...v,id:2},4800,true),null); // second identity has independent arming
});
test('fist-to-open uses prop; lost hands cannot fire a gesture; animation returns to neutral',()=>{const c=new ActionController(),open={id:1,state:'tracked',thumb:.6,fingers:[1,1,1,1]},fist={...open,thumb:.2,fingers:[0,0,0,0]};c.update(open,0,true);c.update(fist,100,true);c.update(fist,560,true);assert.equal(c.update(open,650,true).name,'prop');assert.equal(c.update({...open,state:'lost'},1800,true),null);assert.ok(Math.abs(actionPose({name:'jump',progress:1}).lift)<1e-10);assert.equal(actionPose({name:'turn',progress:1}).turn,1);});
