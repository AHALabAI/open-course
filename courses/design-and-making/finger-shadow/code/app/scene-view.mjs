import {PROP_TYPES,ownerKey} from './scene-state.mjs';
import {paintStage} from './puppet.mjs';
const assets=new Map(),sources={moon:'theater-v3.png',forest:'scene-forest-v5.png',lotus:'scene-lotus-v5.png',lantern:'scene-lantern-v5.png',props:'scene-props-v5.png',pinwheel:'scene-pinwheel-v5.png'};
export const sceneArtReady=typeof Image==='undefined'?Promise.resolve():Promise.all(Object.entries(sources).map(([key,file])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{assets.set(key,im);resolve();};im.onerror=resolve;im.src=new URL('../assets/generated/'+file,import.meta.url).href;})));
export const sceneArtIds=()=>[...assets.keys()];
const rects={table:[8,133,553,252],bridge:[574,87,478,300],drum:[1097,65,331,338],lantern:[1531,6,169,439],peach:[43,490,395,355],ball:[528,506,325,329],butterfly:[950,484,457,363],pinwheel:[1472,444,279,429]};
// The dedicated wheel atlas has a rotating head and separate fixed handle.
export const WHEEL_PARTS={head:[140,27,977,943],stick:[1239,65,86,906],pivot:[640,494]};
export function drawProp(g,item,now=0,reduced=false){
 if(['fan','umbrella','ring'].includes(item.type)){drawDramaProp(g,item);return;}
 const d=PROP_TYPES[item.type],im=assets.get('props');if(!d||!im)return;
 const t=Math.max(0,now-(item.triggerAt??-Infinity)),drop=Math.max(0,now-(item.droppedAt??-Infinity));let y=item.y;
 if(!reduced&&item.type==='ball'&&!item.owner&&drop<800)y-=Math.abs(Math.sin(drop/800*Math.PI*2))*14*(1-drop/800);
 g.save();g.translate(item.x,y);
 if(item.type==='lantern'&&item.owner){g.shadowColor='#f0b53e';g.shadowBlur=10;}
 if(item.type==='butterfly'&&item.owner&&!reduced)g.scale(.75+Math.abs(Math.sin(now/210))*.25,1);
 if(item.type==='drum'&&t<700&&!reduced)g.scale(1+Math.sin(t/45)*.018,1-Math.sin(t/45)*.02);
 if(item.type==='pinwheel'&&assets.has('pinwheel')&&WHEEL_PARTS.head[2]>1){
  const wheel=assets.get('pinwheel'),r=WHEEL_PARTS.head,stick=WHEEL_PARTS.stick;
  g.drawImage(wheel,...stick,-2,-d.h*.20,5,d.h*.70);g.save();g.translate(0,-d.h*.20);if(!reduced&&t<2200)g.rotate(8*Math.PI*(1-(1-t/2200)**3));const k=d.w/r[2],pivot=WHEEL_PARTS.pivot;g.drawImage(wheel,...r,(r[0]-pivot[0])*k,(r[1]-pivot[1])*k,r[2]*k,r[3]*k);g.restore();
 }else g.drawImage(im,...rects[item.type],-d.w/2,-d.h/2,d.w,d.h);
 if(item.type==='drum'&&t<700){g.globalAlpha=1-t/700;g.strokeStyle='#df9d36';g.lineWidth=2;g.beginPath();g.ellipse(0,-d.h*.23,d.w*(.5+t/1800),d.h*(.25+t/2200),0,0,Math.PI*2);g.stroke();}
 g.restore();
}
export class ScenePainter{
 constructor(){this.background=null;this.previous=null;this.changedAt=0;}
 backdrop(g,key,w,h,now,reduced=false){if(key!==this.background){this.previous=this.background;this.background=key;this.changedAt=now;}const base=k=>k==='sea'?'moon':k==='rain'?'lotus':k,im=assets.get(base(key));if(!im){paintStage(g,w,h);return;}const old=assets.get(base(this.previous)),alpha=reduced||!old?1:Math.min(1,(now-this.changedAt)/450);g.save();if(alpha<1)g.drawImage(old,0,0,w,h);g.globalAlpha=alpha;g.drawImage(im,0,0,w,h);g.restore();drawWeather(g,key,w,h);}
 props(g,items,w,h,now,{front=false,actors=[],selected=null,near=null,arranging=false,reduced=false}={}){
  g.save();g.scale(w/1100,h/650);
  for(const item of items){const d=PROP_TYPES[item.type];if(!d||(d.kind==='carry')!==front)continue;let display=item;
   if(item.owner){const actor=actors.find(p=>ownerKey(p)===item.owner);if(actor?.grips&&actor.state==='tracked'){const grip=actor.grips[item.side];display={...item,x:grip[0]*1100/w,y:grip[1]*650/h-(d.gripY||0)*d.h};}}
   drawProp(g,display,now,reduced);
   if(arranging&&item.id===selected){g.save();g.strokeStyle='#9c432a';g.setLineDash([4,3]);g.lineWidth=2;g.strokeRect(display.x-d.w/2-5,display.y-d.h/2-5,d.w+10,d.h+10);g.restore();}
   if(near===item.id&&!arranging){g.save();g.strokeStyle='#f5e3a8';g.lineWidth=2;g.beginPath();g.arc(display.x,display.y+(d.gripY??d.touchY??0)*d.h,12,0,Math.PI*2);g.stroke();g.restore();}
  }g.restore();
 }
}

function drawDramaProp(g,item){
 g.save();g.translate(item.x,item.y);g.lineWidth=2;g.strokeStyle='#5e3122';g.fillStyle='#a8412a';
 if(item.type==='ring'){
  g.lineWidth=16;g.strokeStyle='#b64b32';g.beginPath();g.arc(0,0,33,0,Math.PI*2);g.stroke();g.lineWidth=2;g.strokeStyle='#673d23';g.beginPath();g.arc(0,0,44,0,Math.PI*2);g.stroke();
  for(let a=0;a<4;a++){g.save();g.rotate(a*Math.PI/2+.4);g.fillStyle='#eaca88';g.fillRect(-6,-42,12,18);g.strokeRect(-6,-42,12,18);g.restore();}
 }else if(item.type==='fan'){
  g.fillStyle='#6c7744';g.beginPath();g.moveTo(0,46);g.bezierCurveTo(-68,0,-57,-59,0,-70);g.bezierCurveTo(57,-59,68,0,0,46);g.fill();g.stroke();g.strokeStyle='#e3bd78';
  for(let y=-51;y<30;y+=13){g.beginPath();g.moveTo(0,y+15);g.lineTo(-34,y-5);g.moveTo(0,y+15);g.lineTo(34,y-5);g.stroke();}
  g.strokeStyle='#633725';g.lineWidth=5;g.beginPath();g.moveTo(0,-63);g.lineTo(0,68);g.stroke();
 }else{
  g.strokeStyle='#71442a';g.lineWidth=5;g.beginPath();g.moveTo(0,-72);g.lineTo(0,59);g.quadraticCurveTo(0,73,13,66);g.stroke();
  g.fillStyle='#ad492e';g.lineWidth=2;g.beginPath();g.moveTo(-78,-12);g.quadraticCurveTo(-46,-57,0,-66);g.quadraticCurveTo(46,-57,78,-12);g.quadraticCurveTo(39,-27,0,-12);g.quadraticCurveTo(-39,-27,-78,-12);g.fill();g.stroke();
  g.strokeStyle='#eac687';for(const x of [-60,-35,0,35,60]){g.beginPath();g.moveTo(0,-64);g.quadraticCurveTo(x*.75,-44,x,-17);g.stroke();}
  for(const x of [-47,-25,25,47]){g.beginPath();g.arc(x,-31,3,0,Math.PI*2);g.stroke();}
 }
 g.restore();
}
function drawWeather(g,key,w,h){
 if(!['sea','rain'].includes(key))return;g.save();g.scale(w/1100,h/650);
 if(key==='sea'){
  const fade=g.createLinearGradient(0,315,0,570);fade.addColorStop(0,'#42757900');fade.addColorStop(1,'#3c747875');g.fillStyle=fade;g.fillRect(52,285,996,280);
  for(let row=0;row<4;row++){g.strokeStyle=row%2?'#edce91':'#527879';g.lineWidth=2;g.beginPath();for(let x=500;x<1040;x+=9){const y=400+row*39+Math.sin(x/39+row)*9;x===500?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();}
 }else{g.fillStyle='#35494335';g.fillRect(48,30,1004,550);g.strokeStyle='#64757670';g.lineWidth=1.5;for(let i=0;i<100;i++){const x=65+(i*139)%970,y=65+(i*83)%450;g.beginPath();g.moveTo(x,y);g.lineTo(x-7,y+19);g.stroke();}}
 g.restore();
}
