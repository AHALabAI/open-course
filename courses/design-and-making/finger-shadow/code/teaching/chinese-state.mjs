export const FIELDS=['title','opening','problem','ending','dialogue','detail1','detail2','detail3','source','draft','revision','partner'];
export const CHARACTERS={wukong:'孙悟空',nezha:'哪吒',bajie:'猪八戒',erlang:'二郎神',mulan:'花木兰',yutu:'玉兔',change:'嫦娥',student:'我设计的影人'};
export const PRESETS={chineseStory:'花果山 · 编故事',chineseMoon:'月下 · 神话与节日',chineseRain:'雨中 · 桥边相遇',chinesePractice:'灯下 · 操偶练习',chinesePortrait:'灯下 · 人物特写',chineseFestival:'灯市 · 合作展演',chineseVillage:'月下 · 风俗介绍'};
export const keyFor=id=>'shadow-chinese-v1-'+id;
export function normalizeDraft(raw,task){
 const data={version:1,taskId:task.id,characters:[...task.characters],preset:task.preset,review:[]};
 for(const key of FIELDS)data[key]=typeof raw?.[key]==='string'?raw[key].slice(0,30000):'';
 if(Array.isArray(raw?.characters)&&raw.characters.length===2&&raw.characters.every(id=>Object.hasOwn(CHARACTERS,id)))data.characters=[...raw.characters];
 if(Object.hasOwn(PRESETS,raw?.preset))data.preset=raw.preset;
 if(Array.isArray(raw?.review))data.review=[...new Set(raw.review.filter(n=>Number.isInteger(n)&&n>=0&&n<3))];
 return data;
}
export function readDraft(storage,task){try{return normalizeDraft(JSON.parse(storage.getItem(keyFor(task.id))),task);}catch{return normalizeDraft(null,task);}}
export function writeDraft(storage,task,data){try{storage.setItem(keyFor(task.id),JSON.stringify(normalizeDraft(data,task)));return true;}catch{return false;}}
export function rehearsalLines(data,task){
 const lines=data.dialogue.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,60);
 if(lines.length)return lines;
 const own=[data.opening,data.problem,data.ending].map(s=>s.trim()).filter(Boolean);
 return own.length?own:[...task.cues];
}
export function stageURL(data,task){const q=new URLSearchParams({subject:'chinese',unit:task.id,cast:data.characters.join(','),preset:data.preset});return 'app/index.html?'+q;}
export function exportText(data,task){
 const chunks=[`手指皮影戏 · 语文\n${task.unit} · ${task.title}`,`我的题目\n${data.title}`,`开场\n${data.opening}`,`遇到的事\n${data.problem}`,`结果\n${data.ending}`,`排演台词或动作\n${data.dialogue}`,...task.observations.map((p,i)=>`${p}\n${data['detail'+(i+1)]}`),`资料来处\n${data.source}`,`我的习作\n${data.draft}`,`同伴的话\n${data.partner}`,`我改了哪里\n${data.revision}`];
 return chunks.join('\n\n');
}
