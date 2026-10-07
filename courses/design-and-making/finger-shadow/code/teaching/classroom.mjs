const $=id=>document.getElementById(id);
const ages=JSON.parse($('age-data').textContent);
const lessons=[...document.querySelectorAll('article.lesson')];
const params=new URLSearchParams(location.search);
let age=Object.hasOwn(ages,params.get('age'))?params.get('age'):'10-12';
let lesson=params.get('lesson')||'L01';
let view=params.get('view')==='student'?'student':'teacher';
let slide=0,printKind=null,printing=false;
const track=()=>lessons.filter(p=>p.dataset.age===age);
const current=()=>track().find(p=>p.dataset.id===lesson)||track()[0];

function updateURL(){
  const url=new URL(location.href);
  url.searchParams.set('age',age);url.searchParams.set('lesson',lesson);url.searchParams.set('view',view);
  history.replaceState(null,'',url);
}
function render(){
  lesson=current().dataset.id;
  document.querySelectorAll('.age-buttons button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.age===age)));
  $('age-description').textContent=ages[age].intro;
  $('lesson-select').replaceChildren(...track().map(p=>new Option(`${p.dataset.id} · ${p.dataset.title}`,p.dataset.id,false,p.dataset.id===lesson)));
  lessons.forEach(p=>p.hidden=p!==current());
  document.body.dataset.view=view;
  $('teacher-view').setAttribute('aria-pressed',String(view==='teacher'));
  $('student-view').setAttribute('aria-pressed',String(view==='student'));
  document.querySelector('.slide-controls').hidden=view!=='student';
  current().querySelectorAll('.slide').forEach((p,i)=>p.hidden=i!==slide);
  $('slide-count').textContent=`${slide+1} / 5`;
  $('previous').disabled=slide===0;$('next').disabled=slide===4;
  $('view-status').textContent=`${ages[age].label}，${current().dataset.title}，${view==='teacher'?'教师详案':'学生投屏'}`;
  document.title=`${current().dataset.title} · ${ages[age].label} · 手指皮影戏`;
  updateURL();
}
document.querySelectorAll('.age-buttons button').forEach(b=>b.onclick=()=>{age=b.dataset.age;slide=0;render();});
$('lesson-select').onchange=e=>{lesson=e.target.value;slide=0;render();};
$('teacher-view').onclick=()=>{view='teacher';render();};
$('student-view').onclick=()=>{view='student';render();};
function turn(delta){slide=Math.max(0,Math.min(4,slide+delta));render();if(document.fullscreenElement)$('lesson-stage').scrollTop=0;}
$('previous').onclick=()=>turn(-1);$('next').onclick=()=>turn(1);
document.addEventListener('keydown',e=>{
  if(view!=='student'||e.altKey||e.ctrlKey||e.metaKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;
  if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();turn(1);}
  if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();turn(-1);}
});
$('project').onclick=async()=>{
  view='student';render();
  try{if(!document.fullscreenElement)await $('lesson-stage').requestFullscreen();}
  catch{$('view-status').textContent='浏览器未进入全屏，已切换学生投屏，可继续使用。';}
};
$('leave-fullscreen').onclick=()=>document.exitFullscreen();
document.addEventListener('fullscreenchange',()=>{$('leave-fullscreen').hidden=!document.fullscreenElement;});
function preparePrint(){
  if(printing)return;
  printing=true;
  document.body.classList.toggle('print-sheet',printKind==='sheet');
  lessons.forEach(p=>{
    const included=printKind==='track'?p.dataset.age===age:p===current();
    p.classList.toggle('print-included',included);
    p.querySelectorAll('details').forEach(d=>{d.dataset.wasOpen=String(d.open);if(included)d.open=true;});
  });
}
function afterPrint(){
  if(!printing)return;
  printing=false;
  document.body.classList.remove('print-sheet');
  lessons.forEach(p=>{p.classList.remove('print-included');p.querySelectorAll('details').forEach(d=>{d.open=d.dataset.wasOpen==='true';delete d.dataset.wasOpen;});});
  printKind=null;
}
function printAs(kind){printKind=kind;window.print();}
$('print-plan').onclick=()=>printAs('plan');$('print-sheet').onclick=()=>printAs('sheet');$('print-track').onclick=()=>printAs('track');
window.addEventListener('beforeprint',preparePrint);window.addEventListener('afterprint',afterPrint);
render();
