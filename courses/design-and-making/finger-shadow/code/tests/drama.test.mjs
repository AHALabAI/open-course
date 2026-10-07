import test from 'node:test';
import assert from 'node:assert/strict';
import {wordStates,summarize,reportData} from '../app/drama-state.mjs';
import {StageScene,SETS,PROP_TYPES} from '../app/scene-state.mjs';
test('prompter blue requires matched word and age threshold; others stay black',()=>{
 const content={words:[{index:0,kind:'match'},{index:1,kind:'replace'},{index:2,kind:'match'},{index:3,kind:'missing'}]},pronunciation={words:[{score:60},{score:59},{score:null},{score:0}]};
 assert.deepEqual(wordStates('This lantern is yours.',{content},false).map(w=>w.state),['plain','plain','plain','plain']);
 assert.deepEqual(wordStates('This lantern is yours.',{content,pronunciation},true).map(w=>w.state),['pass','plain','plain','plain']);
 assert.deepEqual(wordStates('This lantern is yours.',{content,pronunciation},true,70).map(w=>w.state),['plain','plain','plain','plain']);
 assert.deepEqual(wordStates('Hello!',null).map(w=>w.state),['plain']);
});
test('performance report does not turn unrecorded or unscored lines into zero or full marks',()=>{
 const play={id:'test',title:'试演',roles:['旁白','演员'],lines:[['旁白','One'],['演员','Two'],['演员','Three']]};
 const attempts=new Map([[0,{state:'done',result:{content:{score:80},pronunciation:{score:60}}}],[1,{state:'unscored',result:{quality:{usable:false}}}]]);
 const summary=summarize(play,attempts);assert.equal(summary.recorded,2);assert.equal(summary.roles[1].content,null);assert.equal(summary.roles[1].contentCount,0);assert.equal(summary.roles[0].pronunciation,60);
 const data=reportData(play,attempts,'performance',{},'再练一句');assert.equal(data.lines[2].state,'unrecorded');assert.equal(data.lines[1].state,'unscored');assert(!('audio' in data));
});
test('all six drama sets have valid carry props and manual scene prevents auto recasting',()=>{
 const ids=Object.keys(SETS).filter(k=>k.startsWith('drama'));assert.equal(ids.length,6);
 for(const id of ids){const scene=new StageScene();scene.manual();scene.apply(id,0);scene.observe(['wukong'],1);scene.observe(['wukong'],20000);assert.equal(scene.preset,id);assert(scene.items.every(i=>PROP_TYPES[i.type]));assert(scene.items.some(i=>PROP_TYPES[i.type].kind==='carry'));assert.equal(scene.serialize().preset,id);}
});
