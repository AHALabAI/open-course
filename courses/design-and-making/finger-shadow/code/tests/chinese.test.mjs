import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeDraft,readDraft,writeDraft,rehearsalLines,stageURL,exportText,keyFor,FIELDS} from '../teaching/chinese-state.mjs';
import {SETS,StageScene} from '../app/scene-state.mjs';
const {tasks}=JSON.parse(readFileSync(new URL('../teaching/chinese-tasks.json',import.meta.url),'utf8'));
test('ten supplied Chinese tasks have distinct grade-specific prompts and usable stages',()=>{
 assert.equal(tasks.length,10);assert.equal(new Set(tasks.map(t=>t.id)).size,10);
 assert.deepEqual([3,4,5,6].map(g=>tasks.filter(t=>t.grade===g).length),[2,3,2,3]);
 for(const task of tasks){assert.ok(SETS[task.preset]);assert.equal(task.characters.length,2);for(const key of ['planPrompts','cues','observations','review']){assert.equal(task[key].length,3);assert.ok(task[key].every(s=>s.length>4));}for(const key of ['teacher','help','stretch','goal'])assert.ok(task[key].length>10);const scene=new StageScene();scene.apply(task.preset);assert.equal(scene.serialize().preset,task.preset);}
});
test('per-task drafts survive switching and normalize hostile or malformed input',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const a=normalizeDraft({draft:'我的文章',characters:['change','yutu'],preset:'chineseMoon',review:[0,0,-1,1,4]},tasks[0]);assert.deepEqual(a.review,[0,1]);assert.ok(writeDraft(storage,tasks[0],a));
 assert.equal(readDraft(storage,tasks[1]).draft,'');assert.equal(readDraft(storage,tasks[0]).draft,'我的文章');
 const b=normalizeDraft({draft:'x'.repeat(40000),characters:['__proto__','unknown'],preset:'constructor',review:[null,'1',2],dialogue:42},tasks[0]);assert.equal(b.draft.length,30000);assert.deepEqual(b.characters,tasks[0].characters);assert.equal(b.preset,tasks[0].preset);assert.deepEqual(b.review,[2]);assert.equal(b.dialogue,'');
 values.set(keyFor(tasks[0].id),'malformed');assert.equal(readDraft(storage,tasks[0]).draft,'');assert.equal(writeDraft({setItem(){throw Error('full');}},tasks[0],a),false);
});
test('manual Chinese prompter uses student lines, then story, then task cues',()=>{
 const data=normalizeDraft(null,tasks[0]);assert.deepEqual(rehearsalLines(data,tasks[0]),tasks[0].cues);data.opening='开场';assert.deepEqual(rehearsalLines(data,tasks[0]),['开场']);data.dialogue='旁白：出场\n\n角色：你好\r\n';assert.deepEqual(rehearsalLines(data,tasks[0]),['旁白：出场','角色：你好']);
 const url=new URL(stageURL(data,tasks[0]),'http://localhost');assert.equal(url.searchParams.get('subject'),'chinese');assert.equal(url.searchParams.get('unit'),tasks[0].id);assert.equal(url.searchParams.get('cast'),data.characters.join(','));
 for(const key of FIELDS)data[key]='<script>真实文字</script>';assert.ok(exportText(data,tasks[0]).includes(data.draft));
});
