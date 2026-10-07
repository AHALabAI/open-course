import {fingerPose,THREAD_COLUMNS} from './finger-map.mjs';
import {drawFinePuppet} from './fine-puppet.mjs';
import {customCharacter,drawCustomPuppet} from './custom-puppet.mjs';
import {actionPose} from './actions.mjs';
import {puppetTurn} from './hand-identity.mjs';
export const CHARACTERS=[
  {id:'wukong',name:'孙悟空',color:'#b73324',accent:'#dbac3f',kind:'传统神话'},
  {id:'nezha',name:'哪吒',color:'#bf373c',accent:'#6e9a7d',kind:'传统神话'},
  {id:'bajie',name:'猪八戒',color:'#70514b',accent:'#b96b57',kind:'传统文学'},
  {id:'erlang',name:'二郎神',color:'#244b61',accent:'#c7a152',kind:'传统神话'},
  {id:'mulan',name:'花木兰',color:'#345e54',accent:'#bc6f39',kind:'传统故事'},
  {id:'yutu',name:'玉兔',color:'#87a37a',accent:'#d8b875',kind:'传统神话'},
  {id:'change',name:'嫦娥',color:'#7caaa0',accent:'#dfadac',kind:'传统神话'}
];
const student=customCharacter();if(student)CHARACTERS.push(student);
function path(ctx,points,fill,stroke='#402518',width=2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
function joint(ctx,x,y){ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle='#f7d58a';ctx.fill();ctx.stroke();}
function limb(ctx,x,y,angle,length,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);path(ctx,[[-5,0],[5,0],[7,length-7],[0,length],[-7,length-7]],color);joint(ctx,0,0);joint(ctx,0,length-5);ctx.restore();}
const buff=typeof document==='undefined'?null:document.createElement('canvas');
if(buff){buff.width=560;buff.height=640;}
function ellipse(g,x,y,rx,ry,fill,stroke='#452b22'){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=1.4;g.stroke();}
function line(g,points,color='#402518',width=1.6){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.stroke();}
function cut(g,x,y,r=2){g.save();g.globalCompositeOperation='destination-out';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.restore();}
function floral(g,x,y,r=9){g.save();g.translate(x,y);for(let j=0;j<6;j++){const a=j*Math.PI/3;g.save();g.rotate(a);ellipse(g,0,-r*.66,r*.23,r*.48,'#e7b965','#743f29');g.restore();}ellipse(g,0,0,r*.26,r*.26,'#983b2a');g.restore();}
function lace(g,y,span){for(let x=-span;x<=span;x+=7){line(g,[[x-3,y],[x,y+4],[x+3,y]],'#f1cf8d',1.5);cut(g,x,y+1,1.05);}}
function profile(g,color,accent,style){
  path(g,[[-17,-65],[-2,-74],[14,-66],[16,-58],[25,-52],[16,-47],[21,-42],[14,-39],[12,-29],[-7,-27],[-18,-43]],'#efc98c');
  line(g,[[0,-57],[10,-56],[3,-52]],'#492827',1.8);line(g,[[10,-42],[16,-42]],'#a82f2b',1.2);
  path(g,[[-22,-64],[-19,-80],[-5,-79],[1,-96],[9,-79],[20,-76],[18,-63]],color);
  lace(g,-69,14);floral(g,-5,-80,7);ellipse(g,-13,-47,5,7,accent);
  if(style==='erlang'){ellipse(g,0,-65,2,5,'#f4e2b5');ellipse(g,0,-65,.8,2,'#27252a');}
}
function head(g,c){const {id,color,accent}=c;
  if(id==='wukong'){
    path(g,[[-24,-48],[-21,-68],[-7,-80],[10,-74],[22,-62],[21,-54],[31,-47],[20,-40],[18,-30],[-3,-27],[-20,-36]],accent);
    path(g,[[-15,-65],[-6,-67],[1,-61],[12,-67],[20,-57],[14,-49],[20,-41],[10,-32],[-7,-33],[-17,-46]],'#f4d499');
    line(g,[[-9,-55],[-2,-59],[4,-55],[13,-57]],'#aa2f26',2.5);line(g,[[6,-47],[16,-43],[8,-40]],'#532b22');
    path(g,[[-24,-67],[-21,-79],[18,-79],[23,-67]],color);floral(g,0,-76,7);
    g.strokeStyle='#774427';g.lineWidth=2;for(const dx of [-8,3]){g.beginPath();g.moveTo(dx,-82);g.bezierCurveTo(-15+dx,-142,55+dx,-149,42+dx,-103);g.stroke();}
    ellipse(g,-21,-49,5,8,'#b9542c');
  }else if(id==='nezha'){
    ellipse(g,0,-48,21,26,'#f0c88c');path(g,[[-22,-54],[-22,-67],[-10,-76],[11,-73],[23,-61],[18,-53],[9,-66],[0,-57],[-7,-65]],'#342522');
    for(const x of [-23,23]){ellipse(g,x,-72,10,11,'#382724');line(g,[[x-7,-73],[x+7,-73]],color,4);line(g,[[x,-66],[x*1.45,-43],[x*1.7,-48]],color,3);}
    line(g,[[-13,-50],[-6,-53],[-2,-49]],'#402518');line(g,[[5,-50],[12,-53],[16,-49]],'#402518');line(g,[[-4,-34],[5,-34]],color);ellipse(g,1,-60,2,3,color);
  }else if(id==='bajie'){
    ellipse(g,0,-48,25,26,'#bd8669');ellipse(g,25,-43,14,10,'#d49678');ellipse(g,30,-44,1.5,2,'#56382c');ellipse(g,21,-44,1.5,2,'#56382c');
    path(g,[[-24,-63],[-40,-70],[-35,-46],[-21,-40]],'#b67759');path(g,[[-26,-65],[-18,-80],[15,-81],[24,-65]],'#362827');line(g,[[-6,-54],[7,-55]],'#34251e',2);line(g,[[2,-31],[18,-32]],'#6b3526');
  }else if(id==='dragon'){
    path(g,[[-24,-28],[-30,-61],[-18,-81],[3,-79],[18,-65],[21,-55],[44,-47],[37,-32],[13,-35],[1,-20]],color);
    path(g,[[-24,-62],[-39,-75],[-31,-48]],accent);line(g,[[-12,-77],[-23,-96],[-15,-100],[-10,-92],[-6,-102]],'#ac8045',3);line(g,[[3,-77],[11,-101],[18,-102]],'#ac8045',3);
    ellipse(g,11,-57,5,3,'#eeedd2');ellipse(g,13,-57,1.5,2.5,'#342821');line(g,[[36,-35],[51,-23],[66,-31]],accent);line(g,[[3,-36],[-7,-13],[-18,-28]],accent,3);floral(g,-15,-57,6);
  }else if(id==='pikachu'){
    path(g,[[-20,-61],[-35,-105],[-24,-110],[-9,-69]],color);path(g,[[12,-67],[23,-111],[34,-107],[27,-60]],color);
    path(g,[[-35,-105],[-24,-110],[-20,-96],[-30,-92]],'#473128');path(g,[[23,-111],[34,-107],[32,-95],[20,-98]],'#473128');
    ellipse(g,0,-45,29,27,color);ellipse(g,-12,-49,3.5,5,'#302720');ellipse(g,12,-49,3.5,5,'#302720');ellipse(g,-22,-34,6,5,'#b63c31');ellipse(g,22,-34,6,5,'#b63c31');line(g,[[-5,-36],[0,-32],[5,-36]],'#3b2c20');floral(g,0,-63,5);
  }else profile(g,color,accent,id);
}
function detailedLimb(g,x,y,angle,len,color,accent,isLeg=false){g.save();g.translate(x,y);g.rotate(angle);path(g,[[-7,0],[7,0],[9,len*.45],[5,len-4],[0,len+2],[-7,len-2],[-9,len*.4]],color);line(g,[[-5,7],[5,7]],accent,3);for(let v=15;v<len-7;v+=8){cut(g,0,v,1.5);line(g,[[-5,v-2],[-2,v],[2,v],[5,v-2]],accent,1);}joint(g,0,0);joint(g,0,len*.52);if(isLeg)path(g,[[-7,len-2],[4,len-2],[13,len+4],[12,len+8],[-8,len+7]],color);else ellipse(g,0,len+2,5,7,'#dfb77f');g.restore();return {x:x-Math.sin(angle)*(len+2),y:y+Math.cos(angle)*(len+2)};}
export function drawPuppet(ctx,p,width,height){
  if(p.character==='student')return drawCustomPuppet(ctx,p,width,height);
  const scale=Math.min(width/1100,height/650)*.94;
  const x=90*scale+p.x*(width-180*scale),y=150*scale+p.y*(height-245*scale),c=CHARACTERS.find(c=>c.id===p.character)||CHARACTERS[p.slot%CHARACTERS.length],control=fingerPose(p),f=control.limbs;
  const fine=drawFinePuppet(ctx,p,width,height,c);if(fine)return fine;
  const g=buff.getContext('2d');g.setTransform(2,0,0,2,280,340);g.clearRect(-140,-170,280,320);g.strokeStyle='#402518';g.lineWidth=1.5;
  if(c.id==='nezha'){g.beginPath();g.moveTo(-20,-17);g.bezierCurveTo(-83,-66,-63,52,-79,31);g.moveTo(20,-16);g.bezierCurveTo(76,-55,78,32,59,55);g.strokeStyle=c.color;g.lineWidth=7;g.stroke();}
  if(c.id==='pikachu')path(g,[[21,15],[47,6],[38,-9],[61,-24],[67,-10],[51,0],[60,19],[28,33]],c.color);
  if(c.id==='dragon'){g.beginPath();g.moveTo(-18,38);g.bezierCurveTo(-87,89,-100,17,-53,11);g.strokeStyle=c.accent;g.lineWidth=10;g.stroke();}
  const leg1=detailedLimb(g,-14,44,.22+(1-f[2])*.48,47,c.color,c.accent,true),leg2=detailedLimb(g,14,44,-.22-(1-f[3])*.48,47,c.color,c.accent,true);
  if(c.id==='nezha')for(const foot of [leg1,leg2]){ellipse(g,foot.x,foot.y+7,13,9,'#da792b');ellipse(g,foot.x,foot.y+7,7,4,'#f5ca58');}
  path(g,[[-24,-18],[-10,-27],[10,-27],[24,-18],[22,11],[33,47],[0,59],[-33,47],[-22,11]],c.color);
  path(g,[[-21,-17],[0,-4],[21,-17],[17,9],[0,15],[-17,9]],c.accent);floral(g,0,26,12);lace(g,42,25);lace(g,3,16);
  for(const xx of [-21,21])for(const yy of [18,29,38])cut(g,xx,yy,1.5);
  if(c.id==='nezha')for(let i=-2;i<=2;i++)path(g,[[i*9-6,40],[i*11,28],[i*9+6,40],[i*9,54]],i%2?c.accent:'#d77974');
  const left=detailedLimb(g,-23,-10,.28+f[0]*1.9,45,c.color,c.accent),right=detailedLimb(g,23,-10,-.28-f[1]*1.9,45,c.color,c.accent);
  g.save();g.translate(0,-25);g.rotate((control.head-.5)*.75);g.translate(0,25);head(g,c);g.restore();
  if(p.props!==false){g.save();g.translate(right.x,right.y);g.rotate(actionPose(p.action).prop*1.6);line(g,[[0,-45],[0,32]],'#68472b',3);ellipse(g,0,-46,8,8,c.accent);g.restore();}
  if(p.pinched)ellipse(g,right.x+12,right.y-15,12,12,'#f3cb68');
  const action=actionPose(p.action);ctx.save();ctx.translate(x,y+action.lift*scale);ctx.scale(scale*puppetTurn(p,action.turn),scale);ctx.globalAlpha=p.state==='lost'||p.state==='dormant'?.35:p.state==='hold'?.65:1;
  // Visible control rig: schematic strings by default, or rods for traditional staging.
  const rig=p.rig||'strings';
  if(rig==='strings'){
    const top=-y/scale+22,span=44;line(ctx,[[-span,top],[span,top]],'#6f563c',3);
    const anchors=[[-38,leg1],[-19,left],[0,{x:0,y:-79}],[19,right],[38,leg2]];
    for(const [a,end] of anchors){line(ctx,[[a,top],[end.x,end.y]],'#66513c',1.3);ellipse(ctx,end.x,end.y,2.4,2.4,'#d7b378');}
  }else if(rig==='rods'){
    const bottom=(height-y)/scale+8;
    for(const end of [{x:0,y:-25},left,right]){line(ctx,[[end.x,end.y],[end.x-20,bottom]],'#645741',2.2);joint(ctx,end.x,end.y);}
  }
  ctx.drawImage(buff,-140,-170,280,320);
  if(!p.hideLabel){ctx.fillStyle='#35241d';ctx.font='13px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.fillText(String(p.slot+1).padStart(2,'0')+' · '+(globalThis.__shadowTranslate?.(c.name)||c.name),0,119);}
  ctx.restore();return {x,y,scale};
}
const backdrop=typeof Image==='undefined'?null:new Image();
if(backdrop)backdrop.src=new URL('../assets/generated/theater-v3.png',import.meta.url).href;
export function paintStage(ctx,w,h){
  if(backdrop?.complete&&backdrop.naturalWidth){ctx.drawImage(backdrop,0,0,w,h);return;}
  ctx.fillStyle='#f4dfad';ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.5,h*.44,10,w*.5,h*.44,w*.65);glow.addColorStop(0,'#fff5d8');glow.addColorStop(1,'#c08b47');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#9f743d';ctx.lineWidth=1;ctx.strokeRect(15,15,w-30,h-30);
  ctx.fillStyle='#956e3a';ctx.globalAlpha=.16;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(w*i/3,h);ctx.lineTo(w*(i/3+.11),h*.52);ctx.lineTo(w*(i/3+.23),h);ctx.fill();}
  ctx.globalAlpha=1;ctx.fillStyle='#7a502c';ctx.fillRect(30,h-32,w-60,3);
}
