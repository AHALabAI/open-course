window.MM_GLOBE_TEXTURE="";
/* Original finite scientific motion, independent of external animation libraries. */
window.MMCinematic=(()=>{
  const $=(s,r)=>r.querySelector(s),$$=(s,r)=>[...r.querySelectorAll(s)];
  const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const globes=new WeakMap();
  function globe(scene,t){
    let state=globes.get(scene);
    if(!state){
      const canvas=$('canvas',scene),gl=canvas?.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
      state={gl,canvas,ready:false,t};globes.set(scene,state);
      if(!gl){scene.dataset.ready='false';scene.dataset.fallback='webgl-unavailable';return;}
      const vs='attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
      const fs=`precision highp float;varying vec2 v;uniform sampler2D tex;uniform float aspect;uniform float angle;
      void main(){vec2 p=vec2(v.x*aspect,v.y)/.82;float r=dot(p,p);if(r>1.045){gl_FragColor=vec4(0.);return;}if(r>1.){float rim=pow(max(0.,1.-(r-1.)/.045),2.);gl_FragColor=vec4(.25,.52,.71,rim*.38);return;}vec3 n=vec3(p,sqrt(1.-r));float lat=asin(clamp(n.y,-1.,1.));float lon=atan(n.x,n.z)+angle;vec2 uv=vec2(fract(lon/6.2831853+.5),lat/3.14159265+.5);vec3 land=texture2D(tex,uv).rgb;float light=max(.0,dot(n,normalize(vec3(-.6,.8,1.2))));vec3 col=land*(.22+.92*light);float edge=pow(1.-n.z,3.4);col=mix(col,vec3(.28,.58,.79),edge*.45);gl_FragColor=vec4(col,1.);}`;
      try{
        function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
        const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
        state.aspect=gl.getUniformLocation(program,'aspect');state.angle=gl.getUniformLocation(program,'angle');state.program=program;
        const image=new Image();image.onload=()=>{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);state.ready=true;scene.dataset.ready='true';globe(scene,state.t);};image.onerror=()=>{scene.dataset.fallback='texture-unavailable';};image.src=window.MM_GLOBE_TEXTURE;
        canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.ready=false;scene.dataset.ready='false';scene.dataset.fallback='context-lost';});
      }catch(e){scene.dataset.ready='false';scene.dataset.fallback=e.message;return;}
    }
    state.t=t;if(!state.ready)return;
    const {gl,canvas}=state;const bounds=scene.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;
    const dpr=Math.min(devicePixelRatio,1.5);const width=Math.round(bounds.width*dpr),height=Math.round(bounds.height*dpr);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl.viewport(0,0,width,height);gl.useProgram(state.program);gl.uniform1f(state.aspect,width/height);gl.uniform1f(state.angle,.78+smooth(t)*.95);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function render(s,t){
    if(!s.dataset.pro)return false;s.dataset.progress=t.toFixed(4);
    const type=s.dataset.pro,ex=s.closest('.exhibit');
    if(type==='globe'){globe(s,t);return true;}
    if(type==='flow'){
      const line=$('[data-flow-path]',s);line.style.strokeDasharray='1';line.style.strokeDashoffset=1-clamp(t/.83);
      $$('[data-pro-node]',s).forEach((n,i)=>n.classList.toggle('lit',t>=i*.18));const pt=line.getPointAtLength(line.getTotalLength()*clamp(t/.83));const dot=$('[data-flow-cursor]',s);dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);dot.style.opacity=t>.96?'0':'1';
    }else if(type==='enso'){
      const q=smooth((t-.12)/.73),end=520+420*q;
      $('[data-ocean-warm]',s).setAttribute('d',`M65 115 H${end} Q${end+15} ${183-q*4} ${end-110} ${224-q*35} Q550 ${190+q*28} 65 189Z`);
      $$('[data-ocean-contour]',s).forEach((p,i)=>p.setAttribute('d',`M65 ${206+i*22} Q${450+q*170} ${175+i*23+q*18} 1020 ${222+i*19-q*18}`));
      $$('[data-ocean-flow]',s).forEach((p,i)=>{const x=100+((i*41+t*430)%860);p.setAttribute('d',`M${x} ${153+Math.sin(i*1.3+t*6)*8} h${15+q*14}`);p.style.opacity=x<end-.1?'.7':'0';});
      $$('[data-trade-wind]',s).forEach((p,i)=>{const x=260+i*155-(t*70)%45,l=95-55*q;p.setAttribute('d',`M${x} 73 h-${l} m14 -8 l-14 8 l14 8`);});
      $('.ocean-state',s).textContent=q<.12?'通常情况下 / 信风把暖水推向西侧':'厄尔尼诺时 / 信风减弱，暖水向东扩展';$('.upwell',s).style.opacity=.75-q*.5;
      const label=$('[data-upwell-label]',s);if(label)label.textContent=q<.12?'冷水上升补充':'上升流减弱';
      $$('[data-enso-state]',ex).forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.ensoState==='normal')===(q<.12))));
    }else if(type==='supply'){
      const cap=+$('[data-capacity]',ex).value,backup=$('[data-backup]',ex).checked,delivered=Math.min(12,cap+(backup?4:0));
      const route=$('.map-route',s),detour=$('[data-detour]',s);
      $$('[data-cargo]',s).forEach((unit,i)=>{const sx=123+i%4*29,sy=151+Math.floor(i/4)*29,tx=825+i%4*32,ty=169+Math.floor(i/4)*33;let x=sx,y=sy;if(i<delivered){const q=clamp((t-i*.027)/.57);if(q<.15){x=sx+(220-sx)*q/.15;y=sy+(225-sy)*q/.15;}else if(q<.8){const path=i<cap?route:detour;const pt=path.getPointAtLength(path.getTotalLength()*(q-.15)/.65);x=pt.x-9;y=pt.y-9;}else{x=865+(tx-865)*(q-.8)/.2;y=232+(ty-232)*(q-.8)/.2;}}unit.setAttribute('x',x);unit.setAttribute('y',y);unit.classList.toggle('held',i>=delivered);});
      detour.style.opacity=backup?'1':'.2';$('[data-delivered]',ex).textContent=delivered;$('[data-gap]',ex).textContent=12-delivered;$('[data-capacity-label]',ex).textContent=cap;
    }else if(type==='ensemble'){
      const values=[12,24,31,44,49,57,64,78],threshold=+$('[data-threshold]',ex).value;
      $$('[data-forecast]',s).forEach((path,i)=>{const q=clamp((t-i*.035)/.63);path.style.strokeDasharray='1';path.style.strokeDashoffset=1-q;path.classList.toggle('over',values[i]>threshold);const pt=path.getPointAtLength(path.getTotalLength()*q);const dot=$(`[data-forecast-dot="${i}"]`,s);dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);});
      $('[data-forecast-threshold]',s).setAttribute('d',`M80 ${391-threshold*4} H825`);$('.threshold-caption',s).setAttribute('y',378-threshold*4);$('[data-exceed]',ex).textContent=values.filter(v=>v>threshold).length+' / 8';$('[data-threshold-label]',ex).textContent=threshold;
    }else if(type==='solar'){
      const night=smooth((t-.48)/.13);$$('[data-sun-ray]',s).forEach((line,i)=>{line.style.opacity=(1-night)*(.25+.3*Math.sin(t*7+i*.7)**2);});$('[data-pro-sun]',s).style.opacity=1-night*.9;$('[data-hot-pipe]',s).style.opacity=1-night*.7;$('[data-hot-pipe]',s).style.strokeDashoffset=-t*130;$('[data-power-pipe]',s).style.strokeDashoffset=-t*220;$('.solar-period',s).textContent=night>.5?'夜间':'白天';$('[data-daylight]',ex).textContent=night>.5?'夜间 / 储存的热继续用于发电':'白天 / 镜场聚光，热量进入储罐';
    }
    return true;
  }
  return {render};
})();

/* Meaningful activity animation: a real three-minute pitch and one-minute response. */
window.MMPitch=(()=>{
  let selected=1,entries=Array.from({length:4},()=>({elapsed:0,running:false})),lastPhase='';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const format=ms=>{const sec=Math.ceil(Math.max(0,ms)/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');};
  function state(){const e=entries[selected-1],phase=e.elapsed>=240000?'done':e.elapsed>=180000?'feedback':'talk';return {selected,entries:entries.map(x=>({...x})),phase,remaining:phase==='done'?0:phase==='feedback'?240000-e.elapsed:180000-e.elapsed,running:e.running};}
  function render(){const s=state();if(!$('[data-pitch-time]'))return;$('[data-pitch-time]').textContent=format(s.remaining);$('[data-pitch-status]').textContent='第'+selected+'组 / '+(s.phase==='done'?'本组完成':s.running?'进行中':entries[selected-1].elapsed?'已暂停':'准备开始');$('[data-pitch-phase]').textContent={talk:'讲述时间',feedback:'反馈时间',done:'请选择下一组'}[s.phase];$('[data-pitch-ring]').style.strokeDashoffset=entries[selected-1].elapsed/240000;$('.pitch-stage').dataset.phase=s.phase;$$('[data-pitch-step]').forEach(el=>el.classList.toggle('active',el.dataset.pitchStep===s.phase));$$('[data-pitch-group]').forEach(b=>{const i=+b.dataset.pitchGroup;b.setAttribute('aria-pressed',String(i===selected));const e=entries[i-1];$(`[data-group-state="${i}"]`).textContent=e.elapsed>=240000?'已完成':e.elapsed?e.running?'进行中':'已暂停':'待开始';});$('[data-pitch-action=toggle]').textContent=s.running?'暂停':s.phase==='done'?'本组已完成':(entries[selected-1].elapsed?'继续':'开始')+'第'+selected+'组';$('[data-pitch-action=toggle]').disabled=s.phase==='done';}
  function command(cmd,val){const e=entries[selected-1];if(cmd==='select'){e.running=false;selected=Math.max(1,Math.min(4,+val));}if(cmd==='toggle'&&e.elapsed<240000)e.running=!e.running;if(cmd==='reset'){e.elapsed=0;e.running=false;}if(cmd==='feedback'){e.elapsed=Math.max(180000,e.elapsed);e.running=e.elapsed<240000;}if(cmd==='pause')e.running=false;render();return state();}
  function tick(delta,active){const e=entries[selected-1];if(!active)e.running=false;if(e.running){e.elapsed=Math.min(240000,e.elapsed+delta);if(e.elapsed>=240000)e.running=false;}render();const phase=state().phase,changed=phase!==lastPhase;lastPhase=phase;return changed;}
  function restore(s){if(!s)return;selected=s.selected||1;entries=s.entries.map(e=>({elapsed:Math.min(240000,Math.max(0,+e.elapsed||0)),running:false}));render();}
  return {state,render,command,tick,restore};
})();

/* A finite, interruptible lecture player. No remote runtime dependencies. */
(() => {
  'use strict';
  document.documentElement.classList.add('enhanced');
  const doc=JSON.parse(document.getElementById('zima-doc').textContent);
  const slides=[...document.querySelectorAll('.slide')];
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  const key='mmcool:'+doc.deckId;
  let session;
  try{session=sessionStorage.getItem(key+':session')||crypto.randomUUID();sessionStorage.setItem(key+':session',session);}catch{session='session-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  let index=0,speaker=null,channel=null,enabled=true,scene=null,raf=0,last=0,motionElapsed=0,motionPaused=false,motionRunning=false,visualVersion=0,entryAnimations=[];
  let pageMs=0,totalMs=0,timerPaused=true,tickAt=performance.now(),group=1;
  const sceneDuration=8000;
  try{MMPitch.restore(JSON.parse(sessionStorage.getItem(key+':pitch')||'null'));}catch{}
  try{const old=JSON.parse(sessionStorage.getItem(key+':state')||'null');if(old){index=old.index||0;pageMs=old.pageMs||0;totalMs=old.totalMs||0;timerPaused=old.timerPaused!==false;}}catch{}
  const hashIndex=slides.findIndex(s=>s.dataset.id===decodeURIComponent(location.hash.slice(1)));
  if(hashIndex>=0&&hashIndex!==index){index=hashIndex;pageMs=0;}
  index=Math.max(0,Math.min(index,slides.length-1));
  const toolbar=document.createElement('nav');toolbar.className='controls';toolbar.setAttribute('aria-label','课件控制');
  toolbar.innerHTML='<button data-prev aria-label="上一页">←</button><select class="page-select" aria-label="选择课件页"></select><button data-next aria-label="下一页">→</button><span class="control-spacer"></span><span class="clock" data-clock>00:00</span><button data-timer>开始计时</button><button data-replay title="R 重播本页演示">重播 R</button><button data-motion-pause>暂停演示</button><span class="motion-state" aria-live="polite"></span><button data-motion-off aria-pressed="false" title="M 切换静态模式">静态 M</button><button data-speaker title="S 打开独立讲者窗">讲者窗 S</button><button data-full title="F 全屏">全屏 F</button>';
  document.body.append(toolbar);
  addEventListener('mmcool:workshop-change',()=>{visualVersion++;sendState();});
  const toast=document.createElement('div');toast.className='error-toast';toast.hidden=true;toast.setAttribute('role','alert');document.body.append(toast);
  function report(s){toast.textContent=s;toast.hidden=false;setTimeout(()=>{toast.hidden=true;},7000);}
  const select=$('.page-select');
  doc.slides.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' / '+s.title;select.append(o);});
  const reduced=()=>mq.matches||!enabled;
  const format=ms=>{const sec=Math.max(0,Math.floor(ms/1000));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');};
  function save(){try{sessionStorage.setItem(key+':state',JSON.stringify({index,pageMs,totalMs,timerPaused}));sessionStorage.setItem(key+':pitch',JSON.stringify(MMPitch.state()));}catch{}}
  function clockTick(){const now=performance.now(),delta=now-tickAt;if(!timerPaused){totalMs+=delta;pageMs+=delta;}if(MMPitch.tick(delta,slides[index]?.dataset.id==='d2-23'))visualVersion++;tickAt=now;const mins=doc.slides[index].min;$('[data-clock]').textContent=format(pageMs)+' / '+mins+'分';$('[data-clock]').title='本页用时 / 本页计划；总用时 '+format(totalMs);$('[data-timer]').textContent=timerPaused?'开始计时':'暂停计时';}
  function pitch(command,value){clockTick();const s=MMPitch.command(command,value);group=s.selected;if(s.running)timerPaused=false;visualVersion++;save();sendState();}
  function timer(cmd){clockTick();if(cmd==='toggle')timerPaused=!timerPaused;if(cmd==='reset-page')pageMs=0;if(cmd==='reset-all'){totalMs=0;pageMs=0;timerPaused=true;}clockTick();save();sendState();}
  function stopMotion(){cancelAnimationFrame(raf);raf=0;motionRunning=false;for(const a of entryAnimations)a.cancel();entryAnimations=[];}
  function setMotionLabel(){
    $('.motion-state').textContent=reduced()?'静态':!scene?'':motionElapsed>=sceneDuration?'演示完成':motionPaused?'演示暂停':document.hidden?'后台暂停':'演示中';
    $('[data-motion-pause]').disabled=!scene||reduced()||motionElapsed>=sceneDuration;
    $('[data-motion-pause]').textContent=motionPaused?'继续演示':'暂停演示';
    $('[data-replay]').disabled=!scene||reduced();
    $('button[data-motion-off]').setAttribute('aria-pressed',String(!enabled));
    $('button[data-motion-off]').textContent=!enabled?'恢复动效 M':'静态 M';
    document.documentElement.dataset.motionOff=String(reduced());
  }
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(v,b));
  const ease=t=>1-Math.pow(1-clamp(t),3);
  function renderMotion(t){
    if(!scene)return;
    scene.dataset.progress=t.toFixed(4);
    if(window.MMCinematic?.render(scene,t))return;
    const type=scene.dataset.scene;
    if(type==='flow'){
      const nodes=$$('[data-node]',scene),n=nodes.length;
      nodes.forEach((node,i)=>node.classList.toggle('lit',t>=i/n));
      const loop=scene.dataset.loop==='1';let x=90+820*clamp(t/(loop?.72:1)),y=125;
      if(loop&&t>.72){const q=(t-.72)/.28;if(q<.15){x=910;y=125+150*q/.15;}else if(q<.85){x=910-820*(q-.15)/.7;y=275;}else{x=90;y=275-150*(q-.85)/.15;}}
      $('[data-traveler]',scene).setAttribute('cx',x);$('[data-traveler]',scene).setAttribute('cy',y);
    }else if(type==='enso'){
      const q=ease(t),end=420+370*q;
      $('[data-warm]',scene).setAttribute('d',`M70 112 H${end} Q${end-10} 160 ${end-100} 180 Q${245+165*q} 220 70 158 Z`);
      const x=150+180*q;$('[data-wind]',scene).setAttribute('d',`M780 75 H${x}`);$('[data-wind-tip]',scene).setAttribute('d',`M${x+15} 63 L${x} 75 L${x+15} 87`);
      $('.cool-rise',scene).style.opacity=1-.65*q;
    }else if(type==='network'){
      $$('[data-chain]',scene).forEach((n,i)=>n.classList.toggle('lit',t>=(i/10)));
      $$('[data-edge]',scene).forEach((n,i)=>n.classList.toggle('lit',t>=(Math.floor(i/2)*3+i%2+1)/10));
    }else if(type==='supply'){
      const ex=scene.closest('.exhibit'),capacity=+$('[data-capacity]',ex).value,backup=$('[data-backup]',ex).checked,delivered=Math.min(12,capacity+(backup?4:0));
      $$('[data-unit]',scene).forEach((unit,i)=>{
        const x=100+i%4*45,y=120+Math.floor(i/4)*46;
        const targetX=733+(i%4)*45,targetY=140+Math.floor(i/4)*46;
        const q=i<delivered?ease((t-i*.035)/.55):0;
        unit.setAttribute('transform',`translate(${(targetX-x)*q} ${(targetY-y)*q})`);
        unit.style.fill=i<delivered?'var(--blue)':'var(--red)';
      });
      $('[data-backup-road]',scene).style.opacity=backup?'1':'.22';
      const texts=$$('text',scene);texts.find(n=>n.textContent.startsWith('主通道：')).textContent='主通道：'+capacity+'份';
      $('[data-delivered]',ex).textContent=delivered;$('[data-gap]',ex).textContent=12-delivered;$('[data-capacity-label]',ex).textContent=capacity;
    }else if(type==='ensemble'){
      const threshold=+$('[data-threshold]',scene.closest('.exhibit')).value,ends=[12,24,31,44,49,57,64,78];
      $$('[data-member]',scene).forEach((line,i)=>{line.style.strokeDasharray='1';line.style.strokeDashoffset=1-clamp((t-i*.045)/.6);line.classList.toggle('exceeds',ends[i]>threshold);});
      $('[data-threshold-line]',scene).setAttribute('d',`M75 ${350-threshold*3.5} H780`);
      $('[data-threshold-label]',scene.closest('.exhibit')).textContent=threshold;
      $('[data-exceed]',scene.closest('.exhibit')).textContent=ends.filter(v=>v>threshold).length+' / 8';
    }else if(type==='vision'){
      const ex=scene.closest('.exhibit'),value=$('[data-vision]',ex).value,stat={low:[48,20,2],mid:[44,8,6],high:[36,2,14]}[value];
      $$('[data-sample]',scene).forEach((node,i)=>{const type=i<50?(i<stat[0]?'tp':'fn'):(i-50<stat[1]?'fp':'tn');node.setAttribute('class','sample '+type);node.style.opacity=t>=(i%50)/60?'1':'.18';});
      $('[data-fp]',ex).textContent=stat[1];$('[data-fn]',ex).textContent=stat[2];
    }else if(type==='solar'){
      const day=t<.55;
      $('.sun',scene).style.opacity=day?'1':'.16';$('[data-energy=sun]',scene).style.opacity=day?'1':'.08';$('[data-energy=heat]',scene).style.opacity=day?'1':'.18';
      $$('[data-energy]',scene).forEach(n=>n.style.strokeDashoffset=String(-t*300));
      $('[data-daylight]',scene).textContent=day?'白天 · 聚光吸热，一部分热量存下来':'夜间 · 储热继续用于发电';
      $('.heat-store',scene).style.fill=day?'#d9a16c':'#e8c6a3';
    }
  }
  function motionFrame(now){
    if(reduced()){stopMotion();motionElapsed=sceneDuration;renderMotion(1);setMotionLabel();return;}
    if(!scene||motionPaused||document.hidden){motionRunning=false;return;}
    motionElapsed=Math.min(sceneDuration,motionElapsed+Math.min(80,now-last));last=now;renderMotion(motionElapsed/sceneDuration);
    if(motionElapsed<sceneDuration){raf=requestAnimationFrame(motionFrame);}else{motionRunning=false;visualVersion++;setMotionLabel();sendState();}
  }
  function resumeMotion(){if(scene&&!reduced()&&!motionPaused&&!document.hidden&&motionElapsed<sceneDuration){last=performance.now();motionRunning=true;raf=requestAnimationFrame(motionFrame);}setMotionLabel();}
  function startMotion(){stopMotion();scene=$('[data-scene]',slides[index]);motionElapsed=reduced()?sceneDuration:0;motionPaused=false;if(scene){renderMotion(reduced()?1:0);resumeMotion();}setMotionLabel();}
  function replay(){if(!scene||reduced())return;motionElapsed=0;motionPaused=false;cancelAnimationFrame(raf);renderMotion(0);resumeMotion();sendState();}
  function pauseMotion(){if(!scene||reduced()||motionElapsed>=sceneDuration)return;motionPaused=!motionPaused;cancelAnimationFrame(raf);motionRunning=false;if(!motionPaused)resumeMotion();setMotionLabel();sendState();}
  function changeMotion(){if(reduced()){stopMotion();motionElapsed=sceneDuration;renderMotion(1);}setMotionLabel();visualVersion++;sendState();}
  function show(next,{preserveTimer=false,initial=false}={}){
    next=Math.max(0,Math.min(slides.length-1,Number(next)||0));
    clockTick();stopMotion();
    if(next!==index)MMPitch.command('pause');
    $$('video').forEach(v=>v.pause());
    if(!preserveTimer&&next!==index)pageMs=0;
    index=next;
    slides.forEach((slide,i)=>{const active=i===index;slide.classList.toggle('active',active);slide.inert=!active;slide.setAttribute('aria-hidden',String(!active));});
    select.value=index;$('[data-prev]').disabled=index===0;$('[data-next]').disabled=index===slides.length-1;
    try{history.replaceState(null,'','#'+slides[index].dataset.id);}catch{}
    if(!reduced()&&!document.hidden){
      const targets=[$('header',slides[index]),...$$('[data-reveal]',slides[index])];
      targets.forEach((el,i)=>{if(el)entryAnimations.push(el.animate([{opacity:.15,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:Math.min(i*55,330),easing:'cubic-bezier(.2,.65,.25,1)'}));});
    }
    startMotion();visualVersion++;save();clockTick();sendState();
    if(innerWidth<760)scrollTo({top:0,behavior:'instant'});
  }
  function onExperiment(ex){if(ex.closest('.slide')!==slides[index])return;motionElapsed=sceneDuration;cancelAnimationFrame(raf);motionRunning=false;motionPaused=false;renderMotion(1);setMotionLabel();visualVersion++;sendState();}
  $$('[data-capacity],[data-backup],[data-threshold],[data-vision]').forEach(el=>el.addEventListener('input',()=>onExperiment(el)));
  $$('[data-group]').forEach(button=>button.addEventListener('click',()=>{group=+button.dataset.group;$$('[data-group]').forEach(b=>b.classList.toggle('selected',b===button));timer('reset-page');visualVersion++;sendState();}));
  $$('[data-pitch-group]').forEach(button=>button.addEventListener('click',()=>pitch('select',+button.dataset.pitchGroup)));
  $$('[data-pitch-action]').forEach(button=>button.addEventListener('click',()=>pitch(button.dataset.pitchAction)));
  $$('[data-fact]').forEach(button=>button.addEventListener('click',()=>{const answer=$('[data-answer="'+button.dataset.fact+'"]');const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));answer.hidden=!open;$('.fact-open',button).textContent=open?'收起':'看看依据';if(open&&!reduced())answer.animate([{opacity:.1,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});visualVersion++;sendState();}));
  $$('[data-enso-state]').forEach(button=>button.addEventListener('click',()=>{
    if(slides[index].dataset.id!=='d1-11')return;
    stopMotion();motionElapsed=button.dataset.ensoState==='normal'?0:sceneDuration;motionPaused=true;
    renderMotion(motionElapsed/sceneDuration);setMotionLabel();visualVersion++;sendState();
  }));
  $$('[data-maritime-case]').forEach(button=>button.addEventListener('click',()=>{
    const exhibit=button.closest('.maritime-exhibit');
    $$('[data-maritime-case]',exhibit).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $$('[data-maritime-panel]',exhibit).forEach(panel=>panel.hidden=panel.dataset.maritimePanel!==button.dataset.maritimeCase);
    visualVersion++;sendState();
  }));
  $$('[data-solar-mode]').forEach(button=>button.addEventListener('click',()=>{
    const ex=button.closest('[data-solar-cycle]'),mode=button.dataset.solarMode;
    ex.dataset.solarCycle=mode;
    $$('[data-solar-mode]',ex).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $('[data-solar-caption]',ex).textContent={day:'镜场收集阳光，熔盐升温；热量可以存下来，也可以用于发电。',night:'太阳落下，镜场停止收热；热盐罐继续向蒸汽发生器供热。',empty:'没有新的热源，可用储热已经耗尽，就不能继续维持发电。'}[mode];
    visualVersion++;sendState();
  }));
  $$('[data-recall]').forEach(view=>{
    const range=$('[data-recall-range]',view);
    function setRecall(value){
      const n=Math.max(0,Math.min(100,Number(value)||0));range.value=n;
      range.setAttribute('value',n);range.setAttribute('aria-valuetext',n===0?'昨天的游戏':n===100?'今天的天气预报':'昨天与今天的画面对照');
      view.style.setProperty('--recall-shift',(-n/2)+'%');
      $$('[data-recall-to]',view).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.recallTo===n)));
      visualVersion++;sendState();
    }
    range.addEventListener('input',()=>setRecall(range.value));
    $$('[data-recall-to]',view).forEach(b=>b.addEventListener('click',()=>setRecall(b.dataset.recallTo)));
  });
  $$('video').forEach(v=>{
    const start=+v.dataset.start||0,end=+v.dataset.end||0;
    v.addEventListener('loadedmetadata',()=>{if(start)v.currentTime=start;});
    v.addEventListener('play',()=>{if(end&&v.currentTime>=end)v.currentTime=start;});
    v.addEventListener('timeupdate',()=>{if(end&&v.currentTime>=end){v.pause();v.currentTime=end;}});
  });
  function full(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>report('浏览器没有进入全屏，可以使用浏览器的 F11。'));}
  function togglePresenter(){
    const url=new URL('speaker-window.html',location.href);url.searchParams.set('deck',doc.deckId);url.searchParams.set('session',session);
    speaker=window.open(url.href,'mmcool-speaker-'+session,'popup=yes,width=1320,height=900');
    if(!speaker){report('讲者窗被浏览器拦截。请允许此页面弹出窗口，再按 S。');return;}
    speaker.focus();
  }
  const snapshotCache=new Map();
  function slideHTML(i){
    if(!slides[i])return '';
    const clone=slides[i].cloneNode(true);clone.classList.add('active');clone.removeAttribute('inert');clone.setAttribute('aria-hidden','false');
    $$('canvas',clone).forEach((canvas,j)=>{const original=$$('canvas',slides[i])[j];try{const img=document.createElement('img');img.src=original.toDataURL();img.className='globe-canvas';img.style.opacity='1';canvas.replaceWith(img);}catch{canvas.remove();}});
    $$('video',clone).forEach(v=>{const image=document.createElement('img');image.src=v.poster;image.alt='视频预览，播放在主窗口进行';image.style.cssText='width:100%;aspect-ratio:16/9;object-fit:contain;background:#102736';v.replaceWith(image);});
    $$('input,select,button',clone).forEach(el=>el.setAttribute('disabled',''));
    return clone.outerHTML;
  }
  function payload(fullInit=false,includePreview=true){return {type:fullInit?'init':'state',deck:doc.deckId,session,index,pageMs,totalMs,timerPaused,group,pitch:MMPitch.state(),facts:$$('[data-fact]').map(b=>b.getAttribute('aria-expanded')==='true'),visualVersion,motion:{enabled:!reduced(),paused:motionPaused,progress:motionElapsed/sceneDuration,hasScene:!!scene},...(fullInit?{doc,base:location.href,css:$$('style').map(n=>n.textContent).join('\n')}:{}),...(includePreview?{current:slideHTML(index),next:slideHTML(index+1)}:{})};}
  function transmit(data){try{channel?.postMessage(data);}catch{}try{if(speaker&&!speaker.closed)speaker.postMessage(data,location.protocol==='file:'?'*':location.origin);}catch{}}
  let stateVersion='';
  function sendState(fullInit=false){
    const v=index+':'+visualVersion;
    const state=payload(fullInit,fullInit||v!==stateVersion);
    if(!fullInit&&v===stateVersion){delete state.current;delete state.next;}else stateVersion=v;
    transmit(state);
  }
  const receivedIds=new Set();
  function receive(data){
    if(!data||data.deck!==doc.deckId||data.session!==session)return;
    if(data.id){if(receivedIds.has(data.id))return;receivedIds.add(data.id);if(receivedIds.size>400)receivedIds.delete(receivedIds.values().next().value);}
    if(data.type==='hello'){sendState(true);return;}
    if(data.type!=='command')return;
    switch(data.command){case 'prev':show(index-1);break;case 'next':show(index+1);break;case 'jump':show(data.value);break;case 'timer':timer(data.value);break;case 'replay':replay();break;case 'motion-pause':pauseMotion();break;case 'motion-off':enabled=!enabled;changeMotion();break;case 'pitch':if(slides[index].dataset.id==='d2-23')pitch(data.value.action,data.value.group);break;case 'fact':if(slides[index].dataset.id==='d1-01')$('[data-fact="'+data.value+'"]')?.click();break;}
  }
  try{channel=new BroadcastChannel('mmcool:'+doc.deckId+':'+session);channel.onmessage=e=>receive(e.data);}catch{}
  addEventListener('message',e=>{if(e.source!==speaker)return;if(location.protocol!=='file:'&&e.origin!==location.origin)return;receive(e.data);});
  $('[data-prev]').onclick=()=>show(index-1);$('[data-next]').onclick=()=>show(index+1);select.onchange=()=>show(+select.value);
  $('[data-timer]').onclick=()=>timer('toggle');$('[data-speaker]').onclick=togglePresenter;$('[data-full]').onclick=full;$('[data-replay]').onclick=replay;$('[data-motion-pause]').onclick=pauseMotion;$('button[data-motion-off]').onclick=()=>{enabled=!enabled;changeMotion();};
  addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||/INPUT|SELECT|TEXTAREA|VIDEO|BUTTON/.test(e.target.tagName)||e.target.isContentEditable)return;
    const k=e.key.toLowerCase();
    if(['arrowright','pagedown',' '].includes(k)){e.preventDefault();show(index+1);}else if(['arrowleft','pageup'].includes(k)){e.preventDefault();show(index-1);}else if(k==='home'){e.preventDefault();show(0);}else if(k==='end'){e.preventDefault();show(slides.length-1);}else if(k==='s'){e.preventDefault();togglePresenter();}else if(k==='f'){e.preventDefault();full();}else if(k==='r'){e.preventDefault();replay();}else if(k==='m'){e.preventDefault();enabled=!enabled;changeMotion();}
  });
  addEventListener('hashchange',()=>{const i=slides.findIndex(s=>s.dataset.id===decodeURIComponent(location.hash.slice(1)));if(i>=0&&i!==index)show(i);});
  mq.addEventListener('change',()=>changeMotion());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);motionRunning=false;setMotionLabel();}else resumeMotion();});
  function finalScenes(){const currentScene=scene;for(const slide of slides){scene=$('[data-scene]',slide);renderMotion(1);}scene=currentScene;}
  addEventListener('beforeprint',()=>{
    stopMotion();finalScenes();
    $$('.hero-globe canvas').forEach(canvas=>{
      try{const host=canvas.closest('.hero-globe');let img=$('[data-print-globe]',host);
      if(!img){img=document.createElement('img');img.dataset.printGlobe='';img.alt='地球影像';host.append(img);}
      img.src=canvas.toDataURL('image/png');}catch{}
    });
  });
  addEventListener('afterprint',()=>{motionElapsed=sceneDuration;renderMotion(1);setMotionLabel();});
  addEventListener('pagehide',()=>{clockTick();save();});
  finalScenes();show(index,{preserveTimer:true,initial:true});
  setInterval(()=>{if(document.documentElement.dataset.motionOff!==String(reduced()))changeMotion();clockTick();save();sendState();},700);
  // Public runtime controls for embedding the player.
  window.mmcool={show,replay,pauseMotion,togglePresenter,timer,pitch,finalScenes,state:()=>({index,pageMs,totalMs,timerPaused,motionElapsed,motionPaused,motionRunning,reduced:reduced(),scene:scene?.dataset.scene,session,deckId:doc.deckId,pitch:MMPitch.state()})};
})();

/* Teacher-entered observations stay in this tab. No network, automatic scores or student identities. */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 document.addEventListener('click', e=>{
  const button=e.target.closest('button'); if(!button)return;
  if(button.dataset.variable){
   const area=button.closest('.workshop');
   $$('[data-variable]',area).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   const output=$('[data-variable-description]',area);if(output)output.textContent=button.dataset.description;
  }
  if(button.dataset.chain){
   const area=button.closest('.workshop');
   $$('[data-chain]',area).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   $$('[data-chain-panel]',area).forEach(p=>{p.hidden=p.dataset.chainPanel!==button.dataset.chain;p.classList.toggle('w-reveal-content',!p.hidden);});
  }
  if(button.dataset.branch){
   const area=button.closest('.workshop');
   $$('[data-branch]',area).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   $$('[data-branch-panel]',area).forEach(p=>{p.hidden=p.dataset.branchPanel!==button.dataset.branch;if(p.hidden)$$('video,audio',p).forEach(v=>v.pause());p.classList.toggle('w-reveal-content',!p.hidden);});
  }
  if(button.hasAttribute('data-export-observations')){
   const rows=$$('[data-observation-row]').map(tr=>({group:tr.dataset.observationRow,condition:$('[data-condition]',tr).value,prediction:$('[data-prediction]',tr).value,observed:$('[data-observed]',tr).value,judgment:$('[data-judgment]',tr).value}));
   const payload={kind:'teacher-entered-classroom-observations',note:'课堂少量尝试；不代表通用性能评测。空白表示尚未记录。',rows};
   const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='mmcool-box-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  dispatchEvent(new Event('mmcool:workshop-change'));
 });
 const observed=e=>{if(e.target.closest('[data-observation-row]')){e.target.setAttribute('value',e.target.value);if(e.target.tagName==='SELECT')[...e.target.options].forEach(o=>o.toggleAttribute('selected',o.selected));$('[data-observation-status]').textContent='已记在当前页面。需要保留时，点“保存记录”。';dispatchEvent(new Event('mmcool:workshop-change'));}};
 document.addEventListener('input',observed);document.addEventListener('change',observed);
 document.addEventListener('toggle',e=>{if(e.target.matches('.workshop details'))dispatchEvent(new Event('mmcool:workshop-change'));},true);
 const fold=()=>$$('.slide:not(.active) video,.slide:not(.active) audio').forEach(v=>{if(!v.paused)v.pause();});
 const observer=new MutationObserver(fold);$$('.slide').forEach(s=>observer.observe(s,{attributes:true,attributeFilter:['class']}));
 // Printing opens the information envelope, then restores the screen state.
 let printDetails=[];
 addEventListener('beforeprint',()=>{printDetails=$$('.workshop details').map(d=>[d,d.open]);printDetails.forEach(([d])=>d.open=true);});
 addEventListener('afterprint',()=>printDetails.forEach(([d,open])=>d.open=open));
})();
