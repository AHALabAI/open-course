export const RUBRIC=[['expression','台词和动作能接上'],['cooperation','轮到自己时能接住同伴'],['story','观众能说出故事经过']];
export const AGE_THRESHOLDS={'7-9':50,'10-12':60,'13-15':70};
export function wordStates(text,result,final=false,threshold=60){const words=text.match(/[a-z]+(?:'[a-z]+)?/gi)||[],rows=result?.content?.words||[],phones=result?.pronunciation?.words||[];return words.map((word,index)=>{const heard=rows.find(r=>r.index===index&&r.kind==='match'),phonetic=phones[index],passed=final&&heard&&Number.isFinite(phonetic?.score)&&phonetic.score>=threshold;return {word,state:passed?'pass':'plain',label:passed?'这次读到了 · 发音参考 '+phonetic.score+' 分':'继续读，或回听后再试',score:final&&Number.isFinite(phonetic?.score)?phonetic.score:null};});}
export function summarize(play,attempts){
 const groups=play.roles.map(role=>{const indexes=play.lines.flatMap((line,i)=>line[0]===role?[i]:[]),rows=indexes.map(i=>attempts.get(i)).filter(Boolean),content=rows.map(r=>r.result?.content?.score).filter(Number.isFinite),phones=rows.map(r=>r.result?.pronunciation?.score).filter(Number.isFinite);const mean=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length):null;
  return {role,expected:indexes.length,recorded:rows.filter(r=>r.state!=='pending').length,pending:rows.filter(r=>r.state==='pending').length,contentCount:content.length,content:mean(content),phoneCount:phones.length,pronunciation:mean(phones)};});
 return {title:play.title,roles:groups,expected:play.lines.length,recorded:groups.reduce((s,r)=>s+r.recorded,0),pending:groups.reduce((s,r)=>s+r.pending,0)};
}
export function reportData(play,attempts,mode,rubric,notes){return {version:1,createdAt:new Date().toISOString(),playId:play.id,title:play.title,mode,summary:summarize(play,attempts),rubric,teacherNotes:notes,
 note:'每句采用本轮最后一次录音；漏录、失败、没有识别到语音不计入均分。台词匹配是 ASR 转写与剧本的词编辑相似度。发音参考分是音素序列相似度，未作儿童或口音校准；不作为考试成绩。教师三项观察分别记录，不与机器分数混合。不含录音。',
 lines:play.lines.map(([role,reference],i)=>({line:i+1,role,reference,...(attempts.has(i)?{state:attempts.get(i).state,result:attempts.get(i).result,error:attempts.get(i).error}:{state:'unrecorded'})}))};}
