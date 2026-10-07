import {FIELDS,CHARACTERS,PRESETS,readDraft,writeDraft,normalizeDraft,rehearsalLines,stageURL,exportText,keyFor} from './chinese-state.mjs';
import {loadDesign} from '../app/custom-puppet.mjs';
const $=id=>document.getElementById(id);
let tasks=[],task=null,data=null,stageOpen=false,restoreSequence=0;
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const setStatus=message=>$('save-status').textContent=message;
function checkStudentDesign(){const available=!!loadDesign();for(const id of ['character-1','character-2']){const option=$(id).querySelector('option[value="student"]');if(option){option.disabled=!available;option.textContent=available?'我设计的影人':'我设计的影人（先到画板保存）';}}return available;}
function save(){if(!task)return;for(const key of FIELDS)data[key]=$(key).value;data.characters=[$('character-1').value,$('character-2').value];data.preset=$('preset').value;data.review=[...document.querySelectorAll('#review input:checked')].map(el=>Number(el.value));const ok=writeDraft(storage,task,data);setStatus(ok?'已保存在这台浏览器。换设备或清理缓存前，请备份全部习作。':'浏览器暂时不能保存。请导出文字或备份，不要直接关闭页面。');refreshStageLink();count();}
function count(){const n=Array.from(data.draft.replace(/\s/g,'')).length;$('word-count').textContent=n?`正文 ${n} 字（含标点），先把事情写清楚。`:'还没有正文，可以先口述给同伴听。';}
function refreshStageLink(){$('stage-link').href=stageURL(data,task);if(stageOpen){$('stage-frame').contentWindow?.postMessage({type:'shadow-chinese-script',taskId:task.id,lines:rehearsalLines(data,task)},location.origin);}}
function closeStage(){const frame=$('stage-frame');frame.src='about:blank';frame.hidden=true;stageOpen=false;$('close-stage').hidden=true;$('load-stage').textContent='开启排演台';$('stage-note').textContent='排演台已收起，摄像头随舞台关闭。写作记录仍在。';}
function renderTask(id){
 if(task)save();if(stageOpen)closeStage();task=tasks.find(t=>t.id===id)||tasks[0];data=readDraft(storage,task);
 $('task').value=task.id;$('unit').textContent=task.unit;$('task-title').textContent='《'+task.title+'》';$('invitation').textContent=task.invitation;$('goal').textContent=task.goal;$('teacher-focus').textContent=task.teacher;$('teacher-help').textContent=task.help;$('teacher-stretch').textContent=task.stretch;
 for(let i=0;i<3;i++){$('prompt-'+(i+1)).textContent=task.planPrompts[i];$('observe-'+(i+1)).textContent=task.observations[i];}
 $('cues').replaceChildren(...task.cues.map((text,i)=>{const p=document.createElement('p');p.textContent=(i+1)+' / '+text;return p;}));
 $('review').replaceChildren(...task.review.map((text,i)=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.value=String(i);input.checked=data.review.includes(i);input.onchange=save;span.textContent=text;label.append(input,span);return label;}));
 for(const key of FIELDS)$(key).value=data[key];$('character-1').value=data.characters[0];$('character-2').value=data.characters[1];$('preset').value=data.preset;count();refreshStageLink();
 const url=new URL(location.href);url.searchParams.set('unit',task.id);url.searchParams.set('grade',$('grade').value);history.replaceState(null,'',url);setStatus('本课记录已载入。习作保存在这台浏览器，换设备前请备份。');
}
function filterTasks(preferred){const grade=$('grade').value,filtered=tasks.filter(t=>grade==='all'||String(t.grade)===grade);$('task').replaceChildren(...filtered.map(t=>new Option(t.unit+' · '+t.title,t.id)));renderTask(filtered.some(t=>t.id===preferred)?preferred:filtered[0].id);}
function download(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function printValues(){document.querySelectorAll('.print-value').forEach(el=>el.remove());for(const key of FIELDS){if(key==='title')continue;const p=document.createElement('div');p.className='print-value';p.textContent=$(key).value;$(key).after(p);}}
window.addEventListener('beforeprint',printValues);
window.addEventListener('afterprint',()=>document.querySelectorAll('.print-value').forEach(el=>el.remove()));
try{
 const response=await fetch('teaching/chinese-tasks.json');if(!response.ok)throw Error('课件资料未载入');const course=await response.json();tasks=course.tasks;
 $('source-note').textContent=course.sourceNote;
 for(const id of ['character-1','character-2'])$(id).replaceChildren(...Object.entries(CHARACTERS).map(([value,name])=>new Option(name,value)));$('preset').replaceChildren(...Object.entries(PRESETS).map(([value,name])=>new Option(name,value)));
 for(const key of FIELDS){if(key!=='title')$(key).maxLength=30000;$(key).addEventListener('input',save);}for(const id of ['character-1','character-2','preset'])$(id).onchange=()=>{save();if(stageOpen)$('stage-note').textContent='选角或布景已改。点“按当前选择重布舞台”应用，正在排演的舞台先保持。';};
 checkStudentDesign();window.addEventListener('focus',checkStudentDesign);window.addEventListener('storage',checkStudentDesign);
 $('grade').onchange=()=>filterTasks(task.id);$('task').onchange=()=>renderTask($('task').value);
 $('teacher-toggle').onclick=()=>{const hidden=!$('teacher-notes').hidden;$('teacher-notes').hidden=hidden;$('teacher-toggle').setAttribute('aria-expanded',String(!hidden));$('teacher-toggle').textContent=hidden?'教师备课':'收起教师备课';};
 $('load-stage').onclick=()=>{save();if(data.characters.includes('student')&&!checkStudentDesign()){$('stage-note').textContent='先到画板保存自己的影人，再开启排演台。';return;}const frame=$('stage-frame');frame.src=stageURL(data,task);frame.hidden=false;stageOpen=true;$('close-stage').hidden=false;$('load-stage').textContent='按当前选择重布舞台';$('stage-note').textContent='排演台已载入。点击舞台中的“开启摄像头”才申请权限。换角色或布景后可重新布置。';};
 $('stage-frame').onload=()=>{if(stageOpen)refreshStageLink();};$('close-stage').onclick=closeStage;
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('stage-frame').contentWindow&&event.data?.type==='shadow-chinese-ready')refreshStageLink();});
 $('print-sheet').onclick=()=>{save();printValues();window.print();};$('download-text').onclick=()=>{save();download('手指皮影戏-'+task.title+'.txt',exportText(data,task),'text/plain;charset=utf-8');};
 $('backup').onclick=()=>{save();download('手指皮影戏-语文习作备份.json',JSON.stringify({type:'shadow-chinese-backup',version:1,createdAt:new Date().toISOString(),drafts:tasks.map(t=>readDraft(storage,t))},null,2),'application/json');};
 $('restore').onchange=async()=>{
  const file=$('restore').files[0],sequence=++restoreSequence;if(!file)return;
  try{if(file.size>4000000)throw Error('备份文件太大');const backup=JSON.parse(await file.text());if(sequence!==restoreSequence)return;
   if(backup.type!=='shadow-chinese-backup'||backup.version!==1||!Array.isArray(backup.drafts)||backup.drafts.length>10)throw Error('不是本工具的习作备份');
   const incoming=[],ids=new Set();for(const raw of backup.drafts){const known=tasks.find(t=>t.id===raw.taskId);if(!known||ids.has(known.id))throw Error('备份包含未知或重复任务');ids.add(known.id);incoming.push([known,normalizeDraft(raw,known)]);}
   save();for(const [known,value] of incoming){const old=storage.getItem(keyFor(known.id));if(old)storage.setItem(keyFor(known.id)+'-before-restore',old);if(!writeDraft(storage,known,value))throw Error('浏览器不能保存，请保留原备份');}
   const id=task.id;task=null;renderTask(id);setStatus(`已恢复 ${incoming.length} 个任务。恢复前的本地记录保留在浏览器中。`);
  }catch(error){setStatus('未完成恢复。'+error.message+'。');}finally{$('restore').value='';}
 };
 const q=new URLSearchParams(location.search),grade=q.get('grade');$('grade').value=['3','4','5','6','all'].includes(grade)?grade:'all';filterTasks(q.get('unit'));$('workshop').hidden=false;
}catch(error){$('load-error').textContent='课件暂时未载入。'+error.message+'。请通过本机课程服务打开。';}
