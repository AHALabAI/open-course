import {CHARACTERS,PRESETS,readDraft,rehearsalLines} from '../teaching/chinese-state.mjs';
import {currentDesign} from './custom-puppet.mjs';
export class ChineseStageController{
 constructor({mount,prepareStage,selectRole}){
  this.prepareStage=prepareStage;this.selectRole=selectRole;this.index=0;this.lines=[];this.task=null;
  mount.innerHTML=`<section class="chinese-stage" aria-label="语文排演提词器"><div class="chinese-stage-heading"><strong id="chinese-stage-title">语文排演</strong><a id="chinese-course-link" href="../chinese-drama.html">回到习作页 ↗</a></div><p id="chinese-before" class="chinese-neighbor"></p><p id="chinese-line" tabindex="0" aria-label="当前台词，上下方向键换句"></p><p id="chinese-after" class="chinese-neighbor"></p><div class="chinese-stage-buttons"><button id="chinese-prev">上一条</button><span id="chinese-position"></span><button id="chinese-next">下一条</button><label>操偶角色<select id="chinese-role"></select></label><button id="chinese-set">重摆本课舞台</button></div><p class="chinese-note">旁白按顺序读，操偶者按台词行动。观众记一个动作和一句话，演完回习作页写。当前句黑色，前后句灰色。</p></section>`;
  this.$=id=>mount.querySelector('#'+id);
  this.$('chinese-prev').onclick=()=>this.step(-1);this.$('chinese-next').onclick=()=>this.step(1);
  this.$('chinese-line').onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();this.step(e.key==='ArrowDown'?1:-1);}};
  this.$('chinese-role').onchange=()=>selectRole(Number(this.$('chinese-role').value));this.$('chinese-set').onclick=()=>prepareStage(this.setup);
  this.receive=e=>{if(e.origin!==location.origin||e.source!==window.parent||!this.task||e.data?.type!=='shadow-chinese-script'||e.data.taskId!==this.task.id||!Array.isArray(e.data.lines))return;this.setLines(e.data.lines.filter(s=>typeof s==='string').slice(0,60).map(s=>s.slice(0,30000)));};
  window.addEventListener('message',this.receive);window.addEventListener('beforeunload',()=>window.removeEventListener('message',this.receive));
  this.ready=this.load().catch(()=>{this.$('chinese-stage-title').textContent='课件暂未载入，请回习作页重试';});
 }
 async load(){
  const response=await fetch('../teaching/chinese-tasks.json');if(!response.ok)throw Error('课件未载入');const {tasks}=await response.json(),q=new URLSearchParams(location.search);this.task=tasks.find(t=>t.id===q.get('unit'))||tasks[0];
  const saved=readDraft({getItem:k=>localStorage.getItem(k)},this.task),requested=(q.get('cast')||'').split(',');
  const characters=requested.length===2&&requested.every(id=>Object.hasOwn(CHARACTERS,id))?requested:saved.characters,preset=Object.hasOwn(PRESETS,q.get('preset'))?q.get('preset'):saved.preset;
  if(!q.get('cast')&&q.get('character')==='student'&&currentDesign())characters[0]='student';
  if(characters.includes('student')&&!currentDesign()){this.$('chinese-stage-title').textContent='请先到画板保存自己的影人，再重新开启排演台';this.$('chinese-set').disabled=true;return;}
  this.setup={characters,preset};this.$('chinese-stage-title').textContent='《'+this.task.title+'》 · 排演';this.$('chinese-course-link').href='../chinese-drama.html?unit='+encodeURIComponent(this.task.id);
  this.$('chinese-role').replaceChildren(...characters.map((id,i)=>new Option((i+1)+' · '+CHARACTERS[id],String(i))));
  this.setLines(rehearsalLines(saved,this.task));this.prepareStage(this.setup);if(window.parent!==window)window.parent.postMessage({type:'shadow-chinese-ready'},location.origin);
 }
 setLines(lines){this.lines=lines.length?lines:[...this.task.cues];this.index=Math.min(this.index,this.lines.length-1);this.render();}
 step(delta){this.index=Math.max(0,Math.min(this.lines.length-1,this.index+delta));this.render();}
 render(){this.$('chinese-before').textContent=this.lines[this.index-1]||' ';this.$('chinese-line').textContent=this.lines[this.index]||' ';this.$('chinese-after').textContent=this.lines[this.index+1]||' ';this.$('chinese-position').textContent=(this.index+1)+' / '+this.lines.length;this.$('chinese-prev').disabled=this.index===0;this.$('chinese-next').disabled=this.index>=this.lines.length-1;}
}
