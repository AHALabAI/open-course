import test from 'node:test';import assert from 'node:assert/strict';
import {StageScene,ownerKey,recommendSet,validateLayout} from '../app/scene-state.mjs';
import {fingerPose,THREAD_COLUMNS} from '../app/finger-map.mjs';
import {measureThumb,amplifyThumb} from '../app/thumb-control.mjs';
const actor=(id,x=500,y=350,pinched=false)=>({id,slot:id-1,state:'tracked',pinched,grips:{left:[x-80,y],right:[x,y]}});
function empty(){const s=new StageScene();s.clear();return s;}
test('default five-finger map is symmetric around middle-finger head',()=>{const pose=fingerPose({thumb:.1,fingers:[.2,.3,.4,.5]});assert.equal(pose.head,.3);pose.limbs.forEach((v,i)=>assert(Math.abs(v-[.2,.4,.1,.5][i])<1e-10));assert.deepEqual(THREAD_COLUMNS,[2,1,3,0,4]);});
test('thumb opening responds when straightness is unchanged; flexion and gain are independent of pinch',()=>{
 const sample=theta=>{const p=Array.from({length:21},()=>({x:0,y:0,z:0}));p[9]={x:0,y:1,z:0};p[1]={x:.4,y:.15,z:0};for(const [i,d] of [[2,.35],[3,.65],[4,.90]])p[i]={x:.4+Math.sin(theta)*d,y:.15+Math.cos(theta)*d,z:0};return p;};
 const narrow=sample(.55),wide=sample(.95),a=measureThumb(narrow),b=measureThumb(wide);assert(Math.abs(a.thumbExtension-b.thumbExtension)<1e-10);assert(b.thumb-a.thumb>.2);assert(amplifyThumb(b.thumb,2)-amplifyThumb(a.thumb,2)>.25);
 const folded=sample(.95);folded[4]={...folded[1]};assert(measureThumb(folded).thumb<a.thumb-.3);
 const rotated=wide.map(p=>({x:-p.y+8,y:p.x-4,z:p.z+3}));assert(Math.abs(measureThumb(rotated).thumb-b.thumb)<1e-8);const mirrored=wide.map(p=>({...p,x:-p.x}));assert(Math.abs(measureThumb(mirrored).thumb-b.thumb)<1e-8);assert.equal(amplifyThumb(-2,3),0);assert.equal(amplifyThumb(2,3),1);
});
test('recommendation uses character combinations, ignores order and does not overwrite manual edits',()=>{assert.equal(recommendSet(['wukong','nezha']),'mountain');assert.equal(recommendSet(['bluey','doraemon']),'play');assert.equal(recommendSet(['kanao','yutu']),'moon');assert.equal(recommendSet(['bluey','wukong']),'festival');assert.equal(recommendSet(['wukong','bluey','bluey']),'festival');const s=new StageScene();s.observe(['bluey'],100);s.observe(['bluey'],9000);assert.equal(s.preset,'play');s.add('peach');s.observe(['yutu'],10000);s.observe(['yutu'],22000);assert.equal(s.preset,'play');assert.equal(s.auto,false);});
test('two hands cannot own one object and reordered detections preserve object ownership',()=>{const s=empty(),i=s.add('ball');i.x=500;i.y=350;s.update([actor(1),actor(2)],0);s.update([actor(1,500,350,true),actor(2,500,350,true)],50);s.update([actor(1,500,350,true),actor(2,500,350,true)],300);assert.equal(i.owner,ownerKey(actor(1)));s.update([actor(2,500,350,true),actor(1,580,320,true)],400);assert.equal(i.owner,ownerKey(actor(1)));assert.equal(i.x,580);assert.equal(i.y,320);});
test('tracking loss freezes a held item, reacquisition keeps owner, open hand drops it onto table',()=>{const s=empty(),table=s.add('table');table.x=600;table.y=480;const i=s.add('peach');i.x=500;i.y=350;s.interact(actor(1),0);s.update([{...actor(1,700,400),state:'lost'}],400);assert.equal(i.x,500);assert.equal(i.owner,ownerKey(actor(1)));s.update([actor(1,600,400,true)],1500);assert.equal(i.x,600);s.update([actor(1,600,400,false)],1700);s.update([actor(1,600,400,false)],1900);assert.equal(i.owner,null);assert.equal(i.support,table.id);assert.equal(i.y,480-106*.46-59/2);});
test('manual button latches carry until release and long missing owner is released without reassignment',()=>{const s=empty(),i=s.add('ball');i.x=500;i.y=350;s.interact(actor(1),0,true);s.update([actor(1,520,350,false)],1000);assert.equal(i.owner,ownerKey(actor(1)));s.update([],9101);assert.equal(i.owner,null);assert.equal(s.held(actor(2)),undefined);});
test('whole-hand close picks up, neutral fingers hold, moving carries, open releases, loss never releases early',()=>{
 const s=empty(),i=s.add('ball');i.x=500;i.y=350;
 const open={...actor(1),grasping:false,handOpen:true};
 const closed={...actor(1,590,350),grasping:true,handOpen:false};
 s.update([open],0);s.update([closed],50);s.update([closed],300);
 assert.equal(i.owner,ownerKey(open));assert.equal(i.x,590);
 s.update([{...closed,grips:{left:[600,330],right:[650,330]}}],400);assert.equal(i.x,650);
 s.update([{...closed,grasping:false,handOpen:false}],500);s.update([{...closed,grasping:false,handOpen:false}],900);assert.equal(i.owner,ownerKey(open));
 s.update([{...open,state:'lost'}],1000);s.update([{...open,state:'lost'}],2000);assert.equal(i.owner,ownerKey(open));
 s.update([open],2100);s.update([open],2300);assert.equal(i.owner,null);
});
test('a distant closed hand cannot take a prop, and button pickup can hand over to grasp/release',()=>{
 const s=empty(),i=s.add('ball');i.x=500;i.y=350;
 s.update([{...actor(1,800,350),grasping:false,handOpen:true}],0);
 for(const now of [50,300,600])s.update([{...actor(1,800,350),grasping:true,handOpen:false}],now);
 assert.equal(i.owner,undefined);
 const p={...actor(1),grasping:false,handOpen:true};s.interact(p,700,true);s.update([p],1000);assert.equal(i.owner,ownerKey(p));
 s.update([{...p,grasping:true,handOpen:false}],1100);s.update([p],1200);s.update([p],1400);assert.equal(i.owner,null);
});
test('drum requires a new deliberate pinch after each trigger; identity loss cannot trigger',()=>{const s=empty(),i=s.add('drum');i.x=500;i.y=377.6;s.update([actor(1)],0);s.update([actor(1,500,350,true)],50);s.update([actor(1,500,350,true)],300);assert.equal(i.count,1);s.update([actor(1,500,350,true)],1500);assert.equal(i.count,1);s.update([{...actor(1),state:'lost'}],1600);assert.equal(i.count,1);s.update([actor(1)],1700);s.update([actor(1,500,350,true)],1750);s.update([actor(1,500,350,true)],2000);assert.equal(i.count,2);});
test('scene serialization strips live ownership, validates limits, and moving a table carries supported objects',()=>{const s=empty(),table=s.add('table'),ball=s.add('ball');table.x=500;table.y=470;ball.x=500;ball.y=390;s.drop(ball,0);assert.equal(ball.support,table.id);const before=ball.x;s.move(table.id,550,470);assert.equal(ball.x,before+50);ball.owner='hand-2-slot-1';const saved=s.serialize();assert(!('owner' in saved.items[1]));assert.equal(new StageScene(saved).items.length,2);assert.throws(()=>validateLayout({...saved,items:[...saved.items,saved.items[0]]}));assert.throws(()=>validateLayout({...saved,items:[{id:3,type:'script',x:1,y:2}]}));for(let i=0;i<15;i++)s.add('lantern');assert.equal(s.items.length,12);s.background='lotus';s.clear();assert.equal(s.backgroundId,'lotus');assert.equal(s.items.length,0);});
