import {planRooftop,besideWall} from './rooftop.mjs';
import {validateCustom,same} from './levels.mjs';
import {THEMES,validTheme} from './themes.mjs';
import {SIZE_PRESETS,checkSize,blankDraft,resizeDraft} from './editor-model.mjs';

const $=s=>document.querySelector(s);
let tool='wall',data,undoDraft=null;
function template(){
  return {name:'我的秘密花园',theme:0,grid:['11111111111','10000010001','10111010101','10001000101','11101011101','10001000001','10111110101','10000010101','10111010101','10001000001','11111111111'].map(r=>[...r].map(Number)),start:[1,1],exit:[9,9],items:[{type:'gem',cell:[3,3]},{type:'gem',cell:[1,7]},{type:'gem',cell:[9,1]}]};
}
try{
  const cached=sessionStorage.getItem('paper-maze-draft');data=cached?JSON.parse(cached):template();
  checkSize(data.grid[0].length,data.grid.length);
  if(data.grid.some(r=>!Array.isArray(r)||r.length!==data.grid[0].length))throw Error();
}catch{data=template();}

function stash(){
  data.name=$('#name').value;data.theme=Number($('#theme').value);
  try{sessionStorage.setItem('paper-maze-draft',JSON.stringify(data));}
  catch{$('#validation').textContent='浏览器未允许保存草稿，请导出作品文件。';}
}
function clearUndo(){undoDraft=null;$('#undo-size').disabled=true;}
function draw(){
  const board=$('#board'),width=data.grid[0].length;
  board.style.setProperty('--columns',width);
  board.style.setProperty('--board-min',(width*35+21)+'px');
  board.replaceChildren();
  data.grid.forEach((row,z)=>row.forEach((v,x)=>{
    const p=[x,z],start=same(p,data.start),exit=same(p,data.exit),door=data.roofExit&&same(p,data.roofExit),gem=data.items.some(i=>same(p,i.cell));
    const b=document.createElement('button');
    b.className='cell '+(door?'door':v?'wall':start?'start':exit?'exit':gem?'gem':'path');
    b.textContent=door?'D':start?'S':exit?'L':gem?'◆':'';
    b.setAttribute('aria-label','第 '+(z+1)+' 行，第 '+(x+1)+' 列：'+(door?'出口门（墙顶）':v?'墙':start?'起点':exit?'梯子':gem?'光晶':'道路'));
    b.onclick=()=>edit(p);board.append(b);
  }));
  $('#stats').textContent='宽 '+width+' × 高 '+data.grid.length+' 格 · '+data.items.length+' 颗光晶';
}
function edit([x,z]){
  const p=[x,z];
  if(tool!=='door'&&(x===0||z===0||x===data.grid[0].length-1||z===data.grid.length-1)){$('#validation').textContent='最外面一圈是围墙，请画里面的格子。';return;}
  if(tool==='wall'&&(same(p,data.start)||same(p,data.exit))){$('#validation').textContent='先把起点或梯子搬到别处，再在这里画墙。';return;}
  if(['gem','start','exit'].includes(tool)&&data.grid[z][x]){$('#validation').textContent='这里是墙。先用“道路”画笔打通它。';return;}
  if(tool==='path'&&data.roofExit&&same(p,data.roofExit)){$('#validation').textContent='先把出口门搬到另一块墙格，再打通这里。';return;}
  if(tool==='exit'&&!besideWall(data.grid,p)){$('#validation').textContent='梯子需要靠墙，请选择旁边有墙的道路格。';return;}
  if(tool==='door'){
    if(data.grid[z][x]!==1){$('#validation').textContent='出口门要放在墙格上。玩家爬上墙顶后才能看到它。';return;}
    data.roofExit=p;
  }else if(tool==='wall'||tool==='path'){
    data.grid[z][x]=tool==='wall'?1:0;data.items=data.items.filter(i=>!same(i.cell,p));
  }else if(tool==='start'||tool==='exit'){
    if(same(p,data[tool==='start'?'exit':'start'])){$('#validation').textContent='起点和梯子要在不同的格子。';return;}
    data[tool]=p;data.items=data.items.filter(i=>!same(i.cell,p));
  }else if(tool==='gem'){
    if(same(p,data.start)||same(p,data.exit)){$('#validation').textContent='光晶要放在起点与梯子之外的道路上。';return;}
    const exists=data.items.some(i=>same(i.cell,p));
    if(!exists&&data.items.length>=16){$('#validation').textContent='已经放了 16 颗，先试试这些够不够有趣。';return;}
    data.items=exists?data.items.filter(i=>!same(i.cell,p)):[...data.items,{type:'gem',cell:p}];
  }
  clearUndo();$('#size-feedback').textContent='';
  $('#validation').textContent='画好了。试试光晶和梯子能不能走到。';draw();stash();
}
for(const [id,label] of [['wall','▧ 墙'],['path','□ 道路'],['start','S 起点'],['exit','L 梯子'],['door','D 出口门'],['gem','◆ 光晶']]){
  const b=document.createElement('button');b.textContent=label;b.dataset.tool=id;b.setAttribute('aria-pressed',String(id===tool));
  b.onclick=()=>{tool=id;document.querySelectorAll('[data-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.tool===tool)));};
  $('#tools').append(b);
}
for(const [value,label] of [...SIZE_PRESETS,['custom','自定义宽、高']])$('#size-preset').add(new Option(label,value));
THEMES.forEach((theme,i)=>$('#theme').add(new Option(theme.name,String(i))));
function updateTheme(){
  const p=THEMES[Number($('#theme').value)]||THEMES[0];
  $('#board').style.setProperty('--wall-color',p.wall);$('#board').style.setProperty('--road-color',p.floor);
  $('#theme-preview').replaceChildren();
  for(const [label,color] of [['墙面',p.wall],['地面',p.floor],['天空',p.sky]]){
    const chip=document.createElement('span');chip.className='theme-chip';
    const swatch=document.createElement('i');swatch.style.background=color;
    chip.append(swatch,document.createTextNode(label));$('#theme-preview').append(chip);
  }
}
function sync(){
  if(!data.roofExit){try{data.roofExit=planRooftop(data.grid,data.exit).door;}catch{}}
  if(!validTheme(data.theme))data.theme=0;
  $('#name').value=data.name;$('#theme').value=String(data.theme);
  $('#map-width').value=data.grid[0].length;$('#map-height').value=data.grid.length;
  const key=data.grid[0].length+'x'+data.grid.length;
  $('#size-preset').value=SIZE_PRESETS.some(p=>p[0]===key)?key:'custom';
  draw();updateTheme();
}
function sizeMessage(message){$('#size-feedback').textContent=message;$('#validation').textContent=message;}
function readSize(){const w=Number($('#map-width').value),h=Number($('#map-height').value);checkSize(w,h);return [w,h];}
$('#size-preset').onchange=()=>{
  if($('#size-preset').value==='custom')return;
  const [w,h]=$('#size-preset').value.split('x');$('#map-width').value=w;$('#map-height').value=h;
};
for(const field of ['#map-width','#map-height'])$(field).oninput=()=>$('#size-preset').value='custom';
$('#apply-size').onclick=()=>{
  try{
    const [w,h]=readSize();
    if(w===data.grid[0].length&&h===data.grid.length){sizeMessage('已经是这个尺寸，可以继续画啦。');return;}
    stash();const result=resizeDraft(data,w,h);undoDraft=structuredClone(data);data=result.draft;
    sync();stash();$('#undo-size').disabled=false;
    sizeMessage('已调整为宽 '+w+' × 高 '+h+' 格。'+(result.moved?'有 '+result.moved+' 个目标因尺寸变化调整了位置（梯子靠墙、门在墙顶）。':'')+'试玩前请检查道路连通；继续画之前可以撤销。');
  }catch(e){sizeMessage(e.message);}
};
$('#blank').onclick=()=>{
  try{
    const [w,h]=readSize();stash();undoDraft=structuredClone(data);data=blankDraft(w,h,data);
    sync();stash();$('#undo-size').disabled=false;
    sizeMessage('已新建 '+w+' × '+h+' 的空白地图，放好了起点、梯子、墙顶出口门和 1 颗光晶。继续画之前可以撤销。');
  }catch(e){sizeMessage(e.message);}
};
$('#undo-size').onclick=()=>{
  if(!undoDraft)return;
  data={...undoDraft,name:$('#name').value,theme:Number($('#theme').value)};
  clearUndo();sync();stash();sizeMessage('已恢复上一个画布。');
};
$('#name').oninput=stash;$('#theme').onchange=()=>{updateTheme();stash();};
$('#play').onclick=()=>{
  stash();
  try{const checked=validateCustom(data);sessionStorage.setItem('paper-maze-custom',JSON.stringify(checked));location.href='index.html?custom=1';}
  catch(e){$('#validation').textContent=e.message;}
};
$('#save').onclick=()=>{
  stash();const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({...data,version:2},null,2)],{type:'application/json'}));
  a.href=url;a.download='my-paper-maze.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('#validation').textContent='作品已交给浏览器下载。保留这一版，下次导入后继续修改。';
};
$('#load').onclick=()=>$('#file').click();
$('#file').onchange=async()=>{
  const file=$('#file').files[0];if(!file)return;
  try{
    if(file.size>100000)throw Error('作品文件太大，请使用工作台导出的 JSON');
    const checked=validateCustom(JSON.parse(await file.text()));
    data={name:checked.name,theme:checked.theme,grid:checked.grid,start:checked.start,exit:checked.exit,roofExit:checked.roofExit,items:checked.items};
    clearUndo();sync();stash();$('#size-feedback').textContent='';$('#validation').textContent='地图已打开，可以接着画。';
  }catch(e){$('#validation').textContent='没有导入：'+e.message;}
  $('#file').value='';
};
$('#reset').onclick=()=>{data=template();clearUndo();sync();stash();$('#size-feedback').textContent='';$('#validation').textContent='已回到起始模板。导出的旧作品仍可重新导入。';};
sync();
