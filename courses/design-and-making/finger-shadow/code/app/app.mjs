import {STATIC_HOST} from './runtime-config.mjs';
import {HandTracker,describeHand,mapPoint,smooth,clamp,targetPositions} from './core.mjs';
import {drawPuppet,paintStage,CHARACTERS} from './puppet.mjs';
import {fineArtReady,fineArtIds,propsFor} from './fine-puppet.mjs';
import {ActionController} from './actions.mjs';
import {hitPuppet,drawSelection} from './selection.mjs';
import {GestureModel,LABELS} from './gesture-model.mjs';
import {currentDesign} from './custom-puppet.mjs';
import {MusicController} from './music.mjs';
import {SceneControls} from './scene-controls.mjs';
import {ScenePainter,sceneArtIds} from './scene-view.mjs';
import {DramaController} from './drama.mjs';
import {ChineseStageController} from './chinese-stage.mjs';
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d'),video=$('video');
if(STATIC_HOST){$('tracking-engine').querySelector('option[value=ocsort]')?.remove();$('tracking-engine').value='browser';}
const W=1100,H=650,tracker=new HandTracker(10,{entryMs:180,gestureHoldMs:90}),poses=new Map();
const defaults={left:.1,right:.9,top:.15,bottom:.85};
let bounds={...defaults},corner=null,lastHands=[],worker=null,stream=null,ready=false,busy=false,mode='pointer',generation=0,lastSend=0,lastVideo=-1,lastTick=0,lastResult=0,demoStart=0;
const actions=new ActionController(),music=new MusicController();
try{const gain=Number(localStorage.getItem('shadow-thumb-gain'));if(gain>=1&&gain<=3)$('thumb-gain').value=String(gain);}catch{}
const thumbGainLabel=()=>{$('thumb-gain-value').textContent=Number($('thumb-gain').value).toFixed(1)+' 倍';};thumbGainLabel();
$('thumb-gain').oninput=()=>{thumbGainLabel();try{localStorage.setItem('shadow-thumb-gain',$('thumb-gain').value);}catch{}};
let pointer={x:.35,y:.55,slot:0,thumb:.5,fingers:[.5,.5,.5,.5],pinched:false,state:'tracked'},puppets=[pointer];
let stageActors=[];
let dramaPointerActors=null;
const sceneUI=new SceneControls({actors:()=>stageActors,selected:()=>Number($('cast-slot').value),canvas}),scene=sceneUI.board,scenery=new ScenePainter();
let score=0,playing=false,dwell=0,lastOwner=null,observations=[];
const gestureModel=new GestureModel(),labelNames={open:'张掌',pinch:'捏合',fist:'握拳',other:'其他',unknown:'不确定'};
let collecting=null,lastSample=0;
document.querySelectorAll('[data-learn]').forEach(b=>b.onclick=()=>{if(mode!=='camera'||lastHands.length!==1){$('learn-status').textContent='请先开启摄像头，仅保留一只清晰可见的手。';return;}collecting={label:b.dataset.learn,left:20,after:performance.now()+1500};$('learn-status').textContent='1.5 秒后开始采集 '+labelNames[collecting.label]+'，保持动作并稍微改变角度。';});
$('learn-reset').onclick=()=>{gestureModel.samples=[];collecting=null;$('learn-enabled').checked=false;$('learn-enabled').disabled=true;$('learn-status').textContent='个人动作样本已清空；使用默认规则。';};
const channel=new BroadcastChannel('finger-shadow-v01');
let disposed=false,lastDesignSend=-3000;
const cast=['wukong','nezha','change','yutu','bajie','erlang','mulan','wukong','nezha','change'],propChoices=Array(10).fill(0),propsVisible=Array(10).fill(true);
const requestedCharacter=new URLSearchParams(location.search).get('character');
if(CHARACTERS.some(c=>c.id===requestedCharacter))cast[0]=requestedCharacter;
const safeName=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(let i=0;i<10;i++)$('cast-slot').add(new Option('角色 '+(i+1),String(i)));
function updateCast(){const slot=Number($('cast-slot').value);$('prop-select').replaceChildren(...(cast[slot]==='student'?[currentDesign().propName]:propsFor(cast[slot])).map((name,i)=>new Option(name,String(i))));$('prop-select').value=String(propChoices[slot]);$('show-props').checked=propsVisible[slot];document.querySelectorAll('#cast-gallery button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===cast[slot])));$('cast-status').textContent='角色 '+(slot+1)+'：'+CHARACTERS.find(c=>c.id===cast[slot]).name;$('selection-label').textContent='已选 '+(slot+1)+' · '+CHARACTERS.find(c=>c.id===cast[slot]).name;}
CHARACTERS.forEach((c,i)=>{const b=document.createElement('button'),thumb=document.createElement('canvas'),name=document.createElement('span');b.type='button';b.dataset.character=c.id;b.setAttribute('aria-label','选择'+c.name);thumb.width=240;thumb.height=260;name.textContent=c.name;if(c.name.length>5)name.className='long-name';b.append(thumb,name);$('cast-gallery').append(b);const g=thumb.getContext('2d');g.save();g.translate(120,130);g.scale(.75,.75);g.translate(-550,-320);drawPuppet(g,{x:.5,y:.42,slot:i,character:c.id,rig:'none',fingers:[.3,.5,.4,.5]},1100,650);g.restore();b.onclick=()=>{cast[Number($('cast-slot').value)]=c.id;updateCast();};});
$('cast-slot').onchange=updateCast;updateCast();
$('prop-select').onchange=()=>propChoices[Number($('cast-slot').value)]=Number($('prop-select').value);
$('show-props').onchange=()=>propsVisible[Number($('cast-slot').value)]=$('show-props').checked;
function selectPuppet(slot){$('cast-slot').value=String(slot);if(mode==='pointer'&&dramaPointerActors?.[slot])pointer=dramaPointerActors[slot];updateCast();$('action-status').textContent='已选 '+CHARACTERS.find(c=>c.id===cast[slot]).name+'，可更换道具或试动作。';}
const dramaMount=document.createElement('div');dramaMount.id='drama-mount';document.querySelector('.stage-view').after(dramaMount);
const prepareDramaStage=play=>{
 scene.manual();scene.releaseAll(performance.now());scene.background='auto';scene.apply(play.preset,performance.now());sceneUI.save();sceneUI.refresh();
 play.characters.forEach((character,i)=>{cast[i]=CHARACTERS.some(c=>c.id===character)?character:'wukong';propsVisible[i]=false;propChoices[i]=0;});
 if(mode==='demo')closeCamera();
 dramaPointerActors=play.characters.map((_,slot)=>({x:slot===0?.25:.73,y:.55,slot,thumb:.5,fingers:[.5,.5,.5,.5],pinched:false,state:'tracked'}));
 if(mode==='pointer')pointer=dramaPointerActors[0];selectPuppet(0);playing=false;
};
const chineseMode=new URLSearchParams(location.search).get('subject')==='chinese';
const drama=chineseMode?new ChineseStageController({mount:dramaMount,prepareStage:prepareDramaStage,selectRole:selectPuppet}):new DramaController({mount:dramaMount,prepareStage:prepareDramaStage,selectRole:slot=>selectPuppet(slot),quiet:()=>{music.userPaused=true;music.player.stop(true);music.message='英语录音 / 跟读，配乐已暂停。';music.refresh();}});
if(chineseMode){document.title='手指皮影戏 · 语文排演｜AHALab';document.querySelector('.heading h1').textContent='排一段戏，留下一幕';}
fineArtReady.then(()=>{document.querySelectorAll('#cast-gallery button').forEach((b,i)=>{const thumb=b.querySelector('canvas'),g=thumb.getContext('2d');g.clearRect(0,0,240,260);g.save();g.translate(120,130);g.scale(.75,.75);g.translate(-550,-320);drawPuppet(g,{x:.5,y:.42,slot:i,character:b.dataset.character,rig:'none',fingers:[.2,.3,.65,.65],props:true},1100,650);g.restore();});});
document.querySelectorAll('[data-finger]').forEach(input=>input.oninput=()=>{const i=Number(input.dataset.finger);if(i===0)pointer.thumb=Number(input.value);else pointer.fingers[i-1]=Number(input.value);});
document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>{const p=mode==='pointer'?pointer:puppets.find(p=>p.slot===Number($('cast-slot').value)&&p.state==='tracked');if(!p){$('action-status').textContent='先让所选角色入场，或回到鼠标练习。';return;}const ok=actions.trigger(p.id??'pointer',button.dataset.action,performance.now());$('action-status').textContent=ok?button.textContent+'。稍等片刻可再次触发。':'动作还没结束，请稍等。';});
$('macro-enabled').onchange=()=>{actions.reset();$('action-status').textContent=$('macro-enabled').checked?'先张掌，再做指定手势；不确定时不会触发。':'已关闭组合手势。五指仍可分别控制。';};
$('bind-hand').onclick=()=>{if(mode!=='camera'||lastHands.length!==1||performance.now()-lastResult>350){$('binding-status').textContent='绑定时请只保留一只清晰可见的手。';return;}const t=tracker.bind(lastHands[0],Number($('cast-slot').value),performance.now());poses.delete(t.id);$('binding-status').textContent='手 '+t.id+' 已绑定 '+CHARACTERS.find(c=>c.id===cast[t.slot]).name+'。';};
$('clear-bindings').onclick=()=>{tracker.reset();poses.clear();actions.reset();$('binding-status').textContent='旧绑定已清空。请依次伸入手，分配新编号。';};
const theater=$('theater');
const stageCamera=document.createElement('button');stageCamera.id='stage-camera';stageCamera.type='button';stageCamera.textContent='开启摄像头';stageCamera.setAttribute('aria-pressed','false');$('camera-view').before(stageCamera);
const syncStageCamera=()=>{const active=!$('stop').disabled;stageCamera.textContent=active?'关闭摄像头':'开启摄像头';stageCamera.setAttribute('aria-pressed',String(active));};
stageCamera.onclick=()=>{if($('stop').disabled)$('camera').click();else $('stop').click();syncStageCamera();};
const cameraButtonObserver=new MutationObserver(syncStageCamera);cameraButtonObserver.observe($('stop'),{attributes:true,attributeFilter:['disabled']});
$('camera-view').onclick=()=>{const split=theater.classList.toggle('split');$('camera-view').textContent=split?'摄像头小窗':'上下分屏';$('camera-view').setAttribute('aria-pressed',String(split));};
function fullscreenLabel(){$('fullscreen').textContent=document.fullscreenElement||theater.classList.contains('expanded')?'退出全屏':'全屏舞台';}
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(theater.classList.contains('expanded'))theater.classList.remove('expanded');else if(theater.requestFullscreen)await theater.requestFullscreen();else theater.classList.add('expanded');}catch{theater.classList.toggle('expanded');}fullscreenLabel();};
document.addEventListener('fullscreenchange',fullscreenLabel);document.addEventListener('keydown',e=>{if(e.key==='Escape'){theater.classList.remove('expanded');fullscreenLabel();}});
let trackMarkup='';
function showTracks(){const states={tracked:'跟踪中',candidate:'正在确认',hold:'等待分离',lost:'暂时看不见',dormant:'角色已保留'};const text=tracker.tracks.map(t=>'<div class="track-row"><span>手 '+t.id+' · '+safeName(CHARACTERS.find(c=>c.id===cast[t.slot]).name)+'</span><small>'+(t.recovering?'正在确认回场':states[t.state])+(t.state==='tracked'?(t.facing===-1?' · 反面':' · 正面')+(t.grasping?' · 握住':t.handOpen?' · 张开':' · 半握'):'')+'</small></div>').join('')+(tracker.unassigned?'<p class="small">有 '+tracker.unassigned+' 只手尚未绑定。请先分开双手；仍无法确认时，单手入镜并手动绑定。</p>':'')||'摄像头开启后显示固定编号。';if(text!==trackMarkup){$('track-list').innerHTML=text;trackMarkup=text;}}

const status=text=>$('status').textContent=text;
function setMode(value){if(mode!==value)scene.releaseAll(performance.now());mode=value;$('mode').textContent={pointer:'鼠标 / 键盘练习',demo:'模拟输入 · 10 个角色',camera:'摄像头实时输入'}[value];}
function closeCamera(message='摄像头已关闭。可继续鼠标练习。'){
  generation++;ready=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;document.querySelector('.preview').classList.remove('live');
  lastHands=[];tracker.reset();poses.clear();actions.reset();showTracks();lastResult=0;collecting=null;$('camera').disabled=false;$('stop').disabled=true;$('hands').disabled=false;$('compute').disabled=false;$('tracking-engine').disabled=false;
  $('tracked').textContent='—';$('latency').textContent='—';$('skeleton').getContext('2d').clearRect(0,0,640,480);
  puppets=[pointer];setMode('pointer');status(message);
}
$('camera').onclick=async()=>{
  closeCamera();const run=generation;$('camera').disabled=true;$('stop').disabled=false;$('hands').disabled=true;$('compute').disabled=true;$('tracking-engine').disabled=true;status('正在请求摄像头并载入本地模型…');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('请使用本机 localhost 或 HTTPS 打开页面');
    const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:720},frameRate:{ideal:30}},audio:false});
    if(run!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;video.srcObject=stream;document.querySelector('.preview').classList.add('live');await video.play();if(run!==generation)return;
    worker=new Worker(new URL('./vision-worker.mjs',import.meta.url));
    const timer=setTimeout(()=>{if(run===generation&&!ready)closeCamera('模型载入超时。检查 vendor 资源后重试。');},60000);
    worker.onerror=e=>{clearTimeout(timer);if(run===generation)closeCamera('模型启动失败：'+e.message);};
    worker.onmessage=({data})=>{
      if(run!==generation)return;
      if(data.type==='ready'){$('tracking-engine-status').textContent=data.tracking==='ocsort'?'正在使用本机 OC-SORT；角色归属另行保留。':'正在使用浏览器追踪。'+($('tracking-engine').value==='ocsort'?'本机服务暂不可用。':'');clearTimeout(timer);ready=true;lastResult=performance.now();lastVideo=-1;setMode('camera');puppets=[];status(data.delegate+' 推理已就绪。保持手掌完整入镜；哪只手控制哪个角色固定绑定，交叉或遮挡不确定时先等待。');}
      else if(data.type==='tracking-fallback'){$('tracking-engine-status').textContent=data.message;}
      else if(data.type==='error'){clearTimeout(timer);closeCamera('识别失败：'+data.message);}
      else if(data.type==='result'){
        busy=false;lastResult=performance.now();lastHands=data.result.landmarks.map((p,i)=>{const h=describeHand(p,data.result.handedness[i]?.[0]?.categoryName,video.videoWidth/video.videoHeight,data.result.worldLandmarks?.[i]);return h?{...h,appearance:data.appearances?.[i]??null,motionId:data.motionIds?.[i]??null}:null;}).filter(h=>h&&Math.max((h.box.right-h.box.left)*video.videoWidth,(h.box.bottom-h.box.top)*video.videoHeight)>=48&&h.points.filter(p=>p.x<0||p.x>1||p.y<0||p.y>1).length<=2);
        if(collecting&&lastResult>=collecting.after&&lastHands.length===1&&lastResult-lastSample>=120){gestureModel.add(collecting.label,lastHands[0].features);lastSample=lastResult;collecting.left--;const counts=gestureModel.counts();$('learn-status').textContent=LABELS.map(l=>labelNames[l]+' '+counts[l]).join(' / ');if(!collecting.left){collecting=null;$('learn-status').textContent+='。本段完成；换角度另采一段可增加多样性。';}if(gestureModel.ready())$('learn-enabled').disabled=false;}
        lastHands.forEach(h=>{const prediction=gestureModel.predict(h.features);if($('learn-enabled').checked&&lastHands.length===1){h.intentPinch=prediction.label==='pinch';h.intentFist=prediction.label==='fist';}});
        if(lastHands.length>1)$('learn-prediction').textContent='多手场景：使用通用规则；个人模型仅作用于单手。';
        if(lastHands.length===1)$('learn-prediction').textContent=$('learn-enabled').checked?'个人模型：'+labelNames[gestureModel.predict(lastHands[0].features).label]:'默认规则 · 可采集个人动作';
        tracker.update(lastHands,lastResult);$('tracked').textContent=String(tracker.tracks.filter(t=>t.state==='tracked').length);$('latency').textContent=Math.round(data.ms)+' ms';
        if(observations.length<36000)observations.push({t:Math.round(lastResult),hands:lastHands.length,inferenceMs:+data.ms.toFixed(2),trackingMs:+(data.trackingMs||0).toFixed(2),configuredHands:Number($('hands').value),smoothingMs:Number($('smoothing').value)});
        drawHands(data.result.landmarks);showTracks();
      }
    };
    worker.postMessage({type:'init',count:Number($('hands').value),delegate:$('compute').value,tracking:STATIC_HOST?'browser':$('tracking-engine').value});
  }catch(e){if(run===generation)closeCamera('未开启摄像头：'+e.message+'。可继续使用鼠标练习。');}
};
function drawHands(hands){
  const c=$('skeleton'),g=c.getContext('2d');c.width=video.videoWidth;c.height=video.videoHeight;g.clearRect(0,0,c.width,c.height);
  const chains=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]];
  g.strokeStyle='#82efd3';g.fillStyle='#fff8da';g.lineWidth=2;
  for(const points of hands){for(const chain of chains){g.beginPath();chain.forEach((id,i)=>{const p=points[id];i?g.lineTo(p.x*c.width,p.y*c.height):g.moveTo(p.x*c.width,p.y*c.height);});g.stroke();}for(const p of points){g.beginPath();g.arc(p.x*c.width,p.y*c.height,3,0,Math.PI*2);g.fill();}}
  for(const t of tracker.tracks.filter(t=>t.state==='tracked')){if(t.box){g.strokeStyle='#82efd3';g.strokeRect(t.box.left*c.width,t.box.top*c.height,(t.box.right-t.box.left)*c.width,(t.box.bottom-t.box.top)*c.height);}g.save();g.translate(t.x*c.width,t.y*c.height+28);if($('mirror').checked)g.scale(-1,1);g.font='bold 17px sans-serif';g.fillStyle='#152d27';g.fillRect(-8,-20,150,28);g.fillStyle='#c0ffe8';g.fillText('手 '+t.id+' · '+CHARACTERS.find(c=>c.id===cast[t.slot]).name,0,0);g.restore();}
}
function mirror(){const transform=$('mirror').checked?'scaleX(-1)':'none';video.style.transform=transform;$('skeleton').style.transform=transform;corner=null;bounds={...defaults};$('cal-status').textContent='镜像设置改变，已重置活动范围。';}
mirror();$('mirror').onchange=mirror;$('stop').onclick=()=>closeCamera();
$('demo').onclick=()=>{closeCamera();setMode('demo');demoStart=performance.now();playing=false;$('score').textContent='接月 0 / 5';status('这是 10 个模拟角色，用于观察画面容量；没有使用摄像头。');};
$('reset').onclick=()=>{dramaPointerActors=null;closeCamera();pointer={...pointer,x:.35,y:.55,pinched:false};puppets=[pointer];score=0;playing=false;dwell=0;$('score').textContent='接月 0 / 5';};
$('game').onclick=()=>{if(mode==='demo'){closeCamera();}scene.releaseAll(performance.now());playing=true;score=0;dwell=0;lastOwner=null;$('score').textContent='接月 0 / 5';canvas.focus();};
$('smoothing').oninput=()=>$('smooth-value').textContent=$('smoothing').value+' ms';
function calibrationPoint(){if(mode!=='camera'||lastHands.length!==1||performance.now()-lastResult>350){$('cal-status').textContent='校准需要一只清晰可见的手。';return null;}const p=lastHands[0];return {x:$('mirror').checked?1-p.x:p.x,y:p.y};}
$('cal-tl').onclick=()=>{const p=calibrationPoint();if(p){corner=p;$('cal-status').textContent='左上角已记录。将掌心移到右下角后记录。';}};
$('cal-br').onclick=()=>{const p=calibrationPoint();if(!p)return;if(!corner||p.x-corner.x<.2||p.y-corner.y<.2){$('cal-status').textContent='活动范围太小或角点顺序不正确，请重新记录。';return;}bounds={left:corner.x,top:corner.y,right:p.x,bottom:p.y};$('cal-status').textContent='校准完成。试试舞台中心和四角。';corner=null;};
$('cal-reset').onclick=()=>{bounds={...defaults};corner=null;$('cal-status').textContent='已恢复默认活动范围。';};
$('export').onclick=()=>{const data={version:1,mode,createdAt:new Date().toISOString(),note:'推理时间不是端到端延迟；不含图像或人体关键点。',bounds,mirror:$('mirror').checked,samples:observations};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='shadow-observation.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function stagePoint(e){const box=canvas.getBoundingClientRect(),ratio=Math.min(box.width/W,box.height/H);return {x:(e.clientX-box.left-(box.width-W*ratio)/2)/ratio,y:(e.clientY-box.top-(box.height-H*ratio)/2)/ratio};}
function point(e){const q=stagePoint(e),scale=.94;return {x:clamp((q.x-90*scale)/(W-180*scale)),y:clamp((q.y-150*scale)/(H-245*scale))};}
let dragging=false,dragOffset={x:0,y:0};
canvas.onpointerdown=e=>{const q=stagePoint(e);canvas.focus();if(sceneUI.pointerDown(q,e))return;const picked=hitPuppet(puppets,q.x,q.y,W,H);if(picked)selectPuppet(picked.slot);if(mode!=='pointer')return;canvas.setPointerCapture(e.pointerId);dragging=true;const pos=point(e);dragOffset=picked&&!playing?{x:pointer.x-pos.x,y:pointer.y-pos.y}:{x:0,y:0};if(!picked||playing)Object.assign(pointer,pos);pointer.pinched=true;};
canvas.onpointermove=e=>{if(sceneUI.pointerMove(stagePoint(e)))return;if(dragging&&mode==='pointer'){const pos=point(e);pointer.x=clamp(pos.x+dragOffset.x);pointer.y=clamp(pos.y+dragOffset.y);}};
canvas.onpointerup=canvas.onpointercancel=()=>{sceneUI.pointerUp();dragging=false;pointer.pinched=false;};
canvas.onkeydown=e=>{if(sceneUI.key(e))return;if(mode!=='pointer')return;const movement={ArrowLeft:[-.015,0],ArrowRight:[.015,0],ArrowUp:[0,-.015],ArrowDown:[0,.015]}[e.key];if(movement){e.preventDefault();pointer.x=clamp(pointer.x+movement[0]);pointer.y=clamp(pointer.y+movement[1]);}if(e.code==='Space'){e.preventDefault();pointer.pinched=true;}};
canvas.onkeyup=e=>{if(e.code==='Space')pointer.pinched=false;};canvas.onblur=()=>{pointer.pinched=false;dragging=false;};
async function sendFrame(now){if(mode!=='camera'||!ready||busy||now-lastSend<45||video.currentTime===lastVideo)return;busy=true;lastSend=now;lastVideo=video.currentTime;const run=generation;try{const bitmap=await createImageBitmap(video);if(run!==generation||!worker){bitmap.close();return;}worker.postMessage({type:'frame',frame:bitmap,timestamp:now},[bitmap]);}catch(e){if(run===generation)closeCamera('读取视频失败：'+e.message);}}
function tick(now){
  if(disposed)return;
  const dt=Math.min(80,now-lastTick||16);lastTick=now;
  if(mode==='camera'){
    if(now-lastResult>500)tracker.update([],now);
    puppets=tracker.tracks.filter(t=>t.confirmed&&t.state!=='dormant').map(t=>{let p=poses.get(t.id);const target=mapPoint(t,bounds,$('mirror').checked);if(!p){p={x:target.x,y:target.y};poses.set(t.id,p);}if(t.state==='tracked'){p.x=smooth(p.x,target.x,dt,Number($('smoothing').value)||.001);p.y=smooth(p.y,target.y,dt,Number($('smoothing').value)||.001);}return {id:t.id,slot:t.slot,state:t.state,fingers:t.fingers,thumb:t.thumb,thumbExtension:t.thumbExtension,pinched:t.pinched,fist:t.fist,grasping:t.grasping,handOpen:t.handOpen,facing:$('flip-hand').checked?t.facing:1,x:p.x,y:p.y};});
    for(const id of poses.keys())if(!tracker.tracks.some(t=>t.id===id))poses.delete(id);
    $('tracked').textContent=String(tracker.tracks.filter(t=>t.state==='tracked').length);sendFrame(now);
  }else if(mode==='demo'){const t=matchMedia('(prefers-reduced-motion: reduce)').matches?0:(now-demoStart)/1000;puppets=Array.from({length:10},(_,i)=>({slot:i,id:i,x:.06+(i%5)*.22,y:.25+Math.floor(i/5)*.5+Math.sin(t+i)*.015,fingers:[.5+.5*Math.sin(t+i),.5+.5*Math.cos(t+i),.5,.5],state:'tracked'}));}
  if(mode==='pointer')puppets=dramaPointerActors||[pointer];
  puppets=puppets.map(p=>({...p,character:cast[p.slot],thumbGain:mode==='camera'?Number($('thumb-gain').value):1,rig:$('rig').value,props:propsVisible[p.slot]&&!scene.held(p),propIndex:propChoices[p.slot],selected:p.slot===Number($('cast-slot').value),action:actions.update(p,now,$('macro-enabled').checked)}));
  showTracks();music.observe(puppets,currentDesign()?.music);
  if(currentDesign()&&now-lastDesignSend>2000){channel.postMessage({type:'design',design:currentDesign()});lastDesignSend=now;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.observe(puppets.map(p=>p.character),now);sceneUI.refresh();
  scenery.backdrop(ctx,scene.backgroundId,W,H,now,reduced);
  scenery.props(ctx,scene.items,W,H,now,{selected:scene.selected,arranging:sceneUI.arranging,reduced});
  if(playing&&score<5){const target=targetPositions[score],scale=.94,x=90*scale+target.x*(W-180*scale),y=150*scale+target.y*(H-245*scale);ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.fillStyle='#fbe392';ctx.fill();ctx.strokeStyle='#9d4831';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#563522';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText(String(score+1),x,y+6);
    const near=puppets.find(p=>p.state==='tracked'&&p.pinched&&Math.hypot((p.x-target.x)*(W-180*scale),(p.y-target.y)*(H-245*scale))<32);const owner=near?(near.id??near.slot):null;
    dwell=near?(owner===lastOwner?dwell+dt:0):0;lastOwner=owner;if(dwell>450){score++;dwell=0;$('score').textContent=score===5?'接月完成！':'接月 '+score+' / 5';if(score===5)playing=false;}
  }
  stageActors=puppets.map(p=>{const geometry=drawPuppet(ctx,p,W,H);return {...p,grips:geometry?.grips};});
  scene.update(stageActors,now,!playing&&!sceneUI.arranging);const near=scene.nearby(stageActors.find(p=>p.slot===Number($('cast-slot').value)));
  scenery.props(ctx,scene.items,W,H,now,{front:true,actors:stageActors,selected:scene.selected,arranging:sceneUI.arranging,near:near?.item.id,reduced});
  puppets.filter(p=>p.selected).forEach(p=>drawSelection(ctx,p,W,H));sceneUI.refresh();channel.postMessage({type:'poses',puppets,scene:scene.items});requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='camera')closeCamera('页面已隐藏，摄像头已停止。回来后可重新开启。');});
window.addEventListener('beforeunload',()=>{disposed=true;stream?.getTracks().forEach(t=>t.stop());worker?.terminate();cameraButtonObserver.disconnect();channel.close();});
if(new URLSearchParams(location.search).has('test'))window.__shadow={snapshot:()=>({mode,puppets,score,playing,selectedSlot:Number($('cast-slot').value),tracks:tracker.tracks,art: fineArtIds(),scene:scene.snapshot(),sceneArt:sceneArtIds(),actors:stageActors,music:{cue:music.policy.current,playing:music.player.enabled,current:music.player.current,context:music.player.context?.state,volume:music.player.volume}}),ready:()=>ready,inject:(hands,time)=>{mode='camera';lastResult=performance.now();tracker.update(hands,time??lastResult);lastHands=hands;},resetTracking:()=>{tracker.reset();poses.clear();}};
requestAnimationFrame(tick);
