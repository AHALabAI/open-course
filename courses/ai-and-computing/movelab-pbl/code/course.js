(() => {
 'use strict';
 document.querySelector('.language-picker').addEventListener('click', event => {
  const language=event.target.closest('a[hreflang]');
  if(!language)return;
  try{localStorage.setItem('ahalab.languageChoice',language.hreflang);}catch{}
  language.hash=location.hash;
 });
 const byId=id=>document.getElementById(id);
 const scene=byId('scene'),plan=byId('plan'),output=byId('distance'),readout=byId('action');
 const measure=byId('line'),slider=byId('offset'),locale=document.documentElement.lang;
 const format=new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2});
 const projection=(x,y)=>[(.13+.74*x+.34*y)/(1+.7*y),(.88-.57*y)/(1+.7*y)];
 const sample=[[0,0],[1,0],[1,1],[0,1]].map(p=>projection(...p));
 const hue={ground:'#283920',line:'#dfff00',ruler:'#738360',measure:'#72deef',screen:'#11150e',ink:'#f5f8ef'};
 let wasm,corners=[],ends=[],calibrated=false,measuring=false,cursor;
 const status=(text='')=>{readout.textContent=text;};

 function graph(canvas, space, content){
  const pen=canvas.getContext('2d');
  const pixels=([x,y])=>[x*canvas.width,y*canvas.height];
  function track(points,fill,stroke,width=2){
   if(!points.length)return;
   pen.beginPath();
   points.map(p=>pixels(space(p))).forEach(([x,y],i)=>i?pen.lineTo(x,y):pen.moveTo(x,y));
   if(fill){pen.closePath();pen.fillStyle=fill;pen.fill();}
   if(stroke){pen.strokeStyle=stroke;pen.lineWidth=width;pen.stroke();}
  }
  function point(p,name,color){
   const [x,y]=pixels(space(p));
   pen.beginPath();pen.arc(x,y,12,0,Math.PI*2);pen.fillStyle=color;pen.fill();
   pen.fillStyle=hue.screen;pen.textAlign='center';pen.textBaseline='middle';
   pen.font='bold 16px system-ui';pen.fillText(name,x,y);
  }
  pen.fillStyle=hue.screen;pen.fillRect(0,0,canvas.width,canvas.height);
  content(track,point,pen,pixels);
 }

 function ground(p){return [0,1].map(axis=>wasm.ground_coordinate(...p,axis));}
 function draw(){
  graph(scene,p=>p,(track,point)=>{
   track(sample,hue.ground,hue.ruler);
   for(let i=1;i<=5;i++)track([projection(0,i/6),projection(1,i/6)],null,hue.ruler);
   sample.forEach((p,i)=>point(p,String(i+1),hue.ink));
   track(calibrated?[...corners,corners[0]]:corners,null,hue.line,3);
   corners.forEach((p,i)=>point(p,String(i+1),hue.line));
   if(ends.length===2)track(ends,null,hue.measure,4);
   ends.forEach((p,i)=>point(p,String(i+1),hue.measure));
   if(cursor)point(cursor,'+',hue.measure);
  });
  plan.hidden=!calibrated;
  measure.disabled=!calibrated;
  measure.setAttribute('aria-pressed',String(measuring));
  output.hidden=ends.length!==2;
  if(!calibrated)return;
  graph(plan,([x,y])=>[.086+.828*y,.23+.54*x],(track,point,pen,pixels)=>{
   track([[0,0],[0,1],[1,1],[1,0]],hue.ground,hue.line);
   for(let i=0;i<=6;i++){
    const pos=i/6;
    track([[0,pos],[1,pos]],null,i===0?'#ffb34c':hue.ruler,i===0?4:2);
    pen.fillStyle=hue.ink;pen.font='17px system-ui';pen.textAlign='center';
    pen.fillText(i/2+' m',pixels([.086+.828*pos,0])[0],295);
   }
   const points=ends.map(ground);
   if(points.length===2)track(points,null,hue.measure,4);
   points.forEach((p,i)=>point(p,String(i+1),hue.measure));
   if(points.length===2){
    const [a,b]=points;
    output.textContent=format.format(Math.hypot((b[0]-a[0])*1.2,(b[1]-a[1])*3))+' m';
   }
  });
 }

 function reset(){corners=[];ends=[];calibrated=measuring=false;status(readout.dataset.start);draw();}
 function calibrate(){
  calibrated=wasm.calibrate(...corners.flat())===1;
  if(!calibrated){corners=[];status(readout.dataset.invalid);}
  else status(readout.dataset.measure);
  draw();
 }
 function pick(p){
  if(!wasm)return;
  if(!calibrated){
   corners.push(p);
   if(corners.length===4)calibrate();
   else{status((corners.length+1)+' / 4');draw();}
  }else if(measuring){
   if(!ground(p).every(Number.isFinite)){status(readout.dataset.outside);return;}
   if(ends.length===2)ends=[];
   ends.push(p);status(ends.length+' / 2');draw();
  }
 }
 scene.addEventListener('click',event=>{
  const r=scene.getBoundingClientRect();
  pick([(event.clientX-r.left-scene.clientLeft)/scene.clientWidth,(event.clientY-r.top-scene.clientTop)/scene.clientHeight]);
 });
 scene.addEventListener('keydown',event=>{
  const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(!steps[event.key]&&event.key!=='Enter')return;
  event.preventDefault();
  cursor??=[.5,.5];
  if(event.key==='Enter')pick([...cursor]);
  else cursor=cursor.map((v,i)=>Math.min(1,Math.max(0,v+steps[event.key][i]*(event.shiftKey?.028:.006))));
  draw();
 });
 scene.addEventListener('blur',()=>{cursor=undefined;draw();});
 for(const id of ['corners','clear'])byId(id).addEventListener('click',()=>{if(wasm)reset();});
 byId('example').addEventListener('click',()=>{if(wasm){reset();corners=sample.map(p=>[...p]);calibrate();}});
 measure.addEventListener('click',()=>{measuring=!measuring;ends=[];status(measuring?'1 / 2':'');draw();});
 function showTime(){
  if(!wasm)return;
  const value=wasm.crossing_ms(820,920,-12,Number(slider.value));
  byId('crossing').textContent=(Number.isFinite(value)?value.toFixed(1)+' ms':'—')+' · d₁ = '+slider.value+' cm';
 }
 slider.addEventListener('input',showTime);
 draw();
 WebAssembly.instantiate(Uint8Array.from(atob(globalThis.measurementWasmBase64),c=>c.charCodeAt(0))).then(({instance})=>{
  wasm=instance.exports;reset();showTime();
 }).catch(()=>status('WebAssembly —'));
})();
