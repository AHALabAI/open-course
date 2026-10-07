import {fingerPose,THREAD_COLUMNS} from './finger-map.mjs';
import {actionPose} from './actions.mjs';
import {puppetTurn} from './hand-identity.mjs';
import {designArtSpec,drawDesignArtPart} from './fine-puppet.mjs';

export const DESIGN_KEY='shadow-puppet-design-v1';
export const PARTS={head:'头',body:'身体',leftArm:'左臂',rightArm:'右臂',leftLeg:'左腿',rightLeg:'右腿',prop:'道具'};
export const COLORS=['#b13d30','#d6a647','#365f54','#244d6b','#6b4568','#e6cf98','#392a24'];
export const DESIGN_TEMPLATES=[{id:'wukong',name:'孙悟空',color:'#b13d30',music:'hero'},{id:'nezha',name:'哪吒',color:'#b13d30',music:'hero'},{id:'change',name:'嫦娥',color:'#7caaa0',music:'moon'},{id:'yutu',name:'玉兔',color:'#87a37a',music:'moon'},{id:'mulan',name:'花木兰',color:'#365f54',music:'hero'},{id:'erlang',name:'二郎神',color:'#244d6b',music:'hero'},{id:'bajie',name:'猪八戒',color:'#70514b',music:'hero'}];
const clone=x=>JSON.parse(JSON.stringify(x));
const shapes={
 head:[[77,239],[80,207],[58,180],[54,122],[75,74],[113,52],[162,59],[193,86],[191,133],[218,147],[199,160],[207,175],[190,184],[180,214],[149,223],[149,247]],
 body:[[98,80],[155,80],[181,100],[188,139],[173,182],[189,248],[69,248],[82,182],[66,139],[74,100]],
 leftArm:[[109,48],[143,48],[153,87],[145,151],[157,233],[142,262],[123,268],[108,247],[114,176],[102,106]],
 rightArm:[[109,48],[143,48],[153,87],[145,151],[157,233],[142,262],[123,268],[108,247],[114,176],[102,106]],
 leftLeg:[[109,46],[149,46],[153,129],[141,233],[183,257],[180,276],[115,277],[100,259],[111,168],[101,93]],
 rightLeg:[[109,46],[149,46],[153,129],[141,233],[183,257],[180,276],[115,277],[100,259],[111,168],[101,93]],
 prop:[[120,281],[120,187],[90,174],[76,137],[84,85],[105,62],[153,62],[178,89],[180,137],[163,173],[136,188],[136,281]]
};
export function newDesign(template='child'){
 const starter=DESIGN_TEMPLATES.find(t=>t.id===template),spec=designArtSpec(template);
 if(starter&&spec){const parts={};for(const id of Object.keys(PARTS)){const p=spec.parts[id],[x,y]=p.offset,[,,w,h]=p.rect;parts[id]={color:starter.color,outline:[[x,y],[x+w*p.scale,y],[x+w*p.scale,y+h*p.scale],[x,y+h*p.scale]],pivot:[...p.pivot],strokes:[],art:template,artPart:id,tint:false};}return {version:1,name:'我的'+starter.name,propName:template==='wukong'?'金箍棒':template==='nezha'?'乾坤圈':template==='change'?'花灯':'随身道具',story:'',move:'',music:starter.music,template,parts};}
 const parts={};
 for(const id of Object.keys(PARTS))parts[id]={color:id==='head'?'#d6a647':id==='prop'?'#365f54':'#b13d30',outline:clone(shapes[id]),pivot:id==='head'?[128,236]:id==='body'?[128,160]:id==='prop'?[128,234]:[128,66],strokes:[]};
 if(template==='rabbit')parts.head.outline=[[76,238],[76,193],[60,161],[63,129],[79,115],[62,56],[68,22],[85,19],[108,91],[119,116],[140,116],[157,49],[178,27],[189,39],[176,122],[192,150],[183,193],[152,220],[151,241]];
 if(template==='warrior')parts.head.outline=[[77,239],[80,207],[60,180],[57,113],[39,104],[64,92],[64,48],[85,53],[101,30],[122,48],[150,30],[167,53],[188,48],[188,91],[204,106],[192,129],[218,147],[199,162],[207,177],[183,191],[174,213],[149,225],[149,247]];
 const mark=(id,points,color='#e6cf98',width=5,tool='ink')=>parts[id].strokes.push({tool,color,width,points});
 // A few editable starter details show how a profile and connected cutwork read in backlight.
 mark('head',[[159,136],[177,128],[185,135]],'#392a24',5);mark('head',[[178,142]],'#392a24',6);mark('head',[[177,184],[190,182]],'#b13d30',4);
 if(template!=='rabbit'){mark('head',[[69,109],[96,91],[129,87],[169,102],[187,107]],'#392a24',16);mark('head',[[77,100],[112,83],[147,88],[174,104]],'#e6cf98',4);}
 else{mark('head',[[78,45],[89,90]],'#b13d30',7);mark('head',[[171,53],[151,112]],'#b13d30',7);}
 mark('body',[[98,88],[126,121],[155,88]],'#e6cf98',6);mark('body',[[126,123],[128,190]],'#d6a647',5);mark('body',[[86,193],[170,193]],'#d6a647',13);mark('body',[[83,234],[94,223],[106,234],[118,223],[130,234],[142,223],[154,234],[169,223],[179,234]],'#e6cf98',4);
 for(const x of [98,158]){mark('body',[[x-5,141],[x,132],[x+5,141]],'#e6cf98',3,'cut');mark('body',[[x-5,166],[x,157],[x+5,166]],'#e6cf98',3,'cut');}
 for(const id of ['leftArm','rightArm','leftLeg','rightLeg']){mark(id,[[116,98],[130,109],[142,98]],'#d6a647',4);mark(id,[[118,153],[132,162],[139,151]],'#e6cf98',3,'cut');mark(id,[[115,224],[146,225]],'#d6a647',8);}
 mark('prop',[[105,70],[153,70]],'#d6a647',9);mark('prop',[[90,154],[167,154]],'#d6a647',9);mark('prop',[[108,88],[101,111],[109,139]],'#e6cf98',5);mark('prop',[[128,87],[128,140]],'#e6cf98',5);mark('prop',[[148,88],[156,112],[147,139]],'#e6cf98',5);
 return {version:1,name:'我的小皮影',propName:'我的花灯',story:'',move:'',music:'play',template,parts};
}
const point=p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=320);
export function validateDesign(input){
 if(!input||input.version!==1||typeof input.name!=='string'||!input.name.trim()||input.name.length>24)throw Error('给角色取一个 1 至 24 字的名字。');
 if(!['hero','play','moon'].includes(input.music))throw Error('请选择一种出场音乐。');
 const templates=['child','rabbit','warrior',...DESIGN_TEMPLATES.map(t=>t.id)];
 const out={version:1,name:input.name.trim(),propName:String(input.propName||'我的道具').slice(0,24),story:String(input.story||'').slice(0,180),move:String(input.move||'').slice(0,120),music:input.music,template:templates.includes(input.template)?input.template:'child',parts:{}};
 let total=0;
 for(const id of Object.keys(PARTS)){
  const p=input.parts?.[id];
  if(!p||!/^#[0-9a-f]{6}$/i.test(p.color)||!point(p.pivot)||!Array.isArray(p.outline)||p.outline.length<3||p.outline.length>1200||!p.outline.every(point)||!Array.isArray(p.strokes)||p.strokes.length>180)throw Error(PARTS[id]+'的分片数据不完整。');
  const strokes=p.strokes.map(s=>{if(!['ink','cut'].includes(s.tool)||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.width)||s.width<1||s.width>40||!Array.isArray(s.points)||!s.points.length||s.points.length>1200||!s.points.every(point))throw Error('画笔数据不正确。');total+=s.points.length;return {tool:s.tool,color:s.color,width:s.width,points:clone(s.points)};});
  total+=p.outline.length;if(total>18000)throw Error('笔画太多了，请减少一些细节再导入。');
  out.parts[id]={color:p.color,pivot:clone(p.pivot),outline:clone(p.outline),strokes};
  if(p.art){if(p.art!==out.template||!DESIGN_TEMPLATES.some(t=>t.id===p.art)||p.artPart!==id)throw Error('人物底稿来源不正确。');Object.assign(out.parts[id],{art:p.art,artPart:id,tint:p.tint===true});}
 }
 return out;
}
export function loadDesign(){try{const raw=globalThis.localStorage?.getItem(DESIGN_KEY);return raw?validateDesign(JSON.parse(raw)):null;}catch{return null;}}
let saved=loadDesign();
export function currentDesign(){return saved;}
export function receiveDesign(d){saved=validateDesign(d);return saved;}
export function saveDesign(d){const valid=validateDesign(d);globalThis.localStorage.setItem(DESIGN_KEY,JSON.stringify(valid));saved=valid;return valid;}
export function customCharacter(){return saved?{id:'student',name:saved.name,color:'#b13d30',accent:'#d6a647',kind:'我的作品'}:null;}
function polygon(g,points){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();}
export function drawPart(g,part,guide=false){
 g.clearRect(0,0,256,320);const art=part.art&&drawDesignArtPart(g,part.art,part.artPart);if(!art){polygon(g,part.outline);g.fillStyle=part.color;g.fill();}g.save();if(art){if(part.tint){g.globalCompositeOperation='source-atop';g.globalAlpha=.35;g.fillStyle=part.color;g.fillRect(0,0,256,320);g.globalAlpha=1;}}else g.clip();
 for(const s of part.strokes){g.globalCompositeOperation=s.tool==='cut'?'destination-out':art?'source-atop':'source-over';g.strokeStyle=s.color;g.fillStyle=s.color;g.lineWidth=s.width;g.lineCap='round';g.lineJoin='round';g.beginPath();s.points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));if(s.points.length===1){g.arc(...s.points[0],s.width/2,0,Math.PI*2);g.fill();}else g.stroke();}
 g.restore();if(!art){polygon(g,part.outline);g.strokeStyle='#47301f';g.lineWidth=1.4;g.stroke();}
 if(guide){g.save();g.setLineDash([3,3]);g.strokeStyle='#fff8d5';g.lineWidth=2;g.beginPath();g.arc(...part.pivot,11,0,Math.PI*2);g.stroke();g.setLineDash([]);g.fillStyle='#f2d482';g.beginPath();g.arc(...part.pivot,4,0,Math.PI*2);g.fill();g.strokeStyle='#65422a';g.stroke();g.restore();}
}
const cache=new WeakMap();
function partCanvases(d){if(cache.has(d))return cache.get(d);const map={};for(const id of Object.keys(PARTS)){const c=document.createElement('canvas');c.width=256;c.height=320;drawPart(c.getContext('2d'),d.parts[id]);map[id]=c;}cache.set(d,map);return map;}
export function invalidateDesign(d){cache.delete(d);}
export function drawCustomPuppet(ctx,p,width,height,design=p.design||saved){
 if(!design)return false;
 const images=partCanvases(design),scale=Math.min(width/1100,height/650)*.94,x=90*scale+p.x*(width-180*scale),y=150*scale+p.y*(height-245*scale),control=fingerPose(p),f=control.limbs,a=actionPose(p.action),bp=design.parts.body.pivot,spec=designArtSpec(design.template),bodyK=spec?.parts.body.stageScale||.43;
 const anchor=(x,y)=>[(x-bp[0])*bodyK,(y-bp[1])*bodyK],attachment=id=>spec?anchor(...spec.anchors[id]):({leftLeg:anchor(103,238),rightLeg:anchor(153,238),leftArm:anchor(78,111),rightArm:anchor(178,111),head:anchor(128,85)})[id],ends=[];
 const stamp=(id,pos,angle,k)=>{ctx.save();ctx.translate(...pos);ctx.rotate(angle);const part=design.parts[id];ctx.drawImage(images[id],-part.pivot[0]*k,-part.pivot[1]*k,256*k,320*k);ctx.restore();};
 const limb=(id,pos,angle,index,k=spec?.parts[id].stageScale||.32)=>{stamp(id,pos,angle,k);const pivot=design.parts[id].pivot,tip=spec?.parts[id].tip||[pivot[0],260],dx=(tip[0]-pivot[0])*k,dy=(tip[1]-pivot[1])*k;ends[index]=[pos[0]+Math.cos(angle)*dx-Math.sin(angle)*dy,pos[1]+Math.sin(angle)*dx+Math.cos(angle)*dy];};
 ctx.save();ctx.translate(x,y+a.lift*scale);ctx.scale(scale*puppetTurn(p,a.turn),scale);ctx.globalAlpha=p.state==='lost'||p.state==='dormant'?.3:p.state==='hold'?.65:1;
 limb('leftLeg',attachment('leftLeg'),spec?.04+(.5-f[2])*.55:.08+(1-f[2])*.95,3);limb('rightLeg',attachment('rightLeg'),spec?-.04-(.5-f[3])*.55:-.08-(1-f[3])*.95,4);
 const armAngle=v=>spec?.04+.32*Math.min(v,.5)*2+1.05*Math.max(0,v-.5)*2:.16+v*1.45;
 const drawArms=()=>{limb('leftArm',attachment('leftArm'),armAngle(f[0]),1);limb('rightArm',attachment('rightArm'),-armAngle(f[1])-a.prop*.8,2);};if(!spec?.armsInFront)drawArms();
 const head=attachment('head'),ha=(control.head-.5)*(spec?.42:.75),drawHead=()=>stamp('head',head,ha,spec?.parts.head.stageScale||.34);if(spec?.headBehind)drawHead();stamp('body',[0,0],0,bodyK);if(!spec?.headBehind)drawHead();if(spec?.armsInFront)drawArms();ends[0]=[head[0]+Math.sin(ha)*45,head[1]-Math.cos(ha)*45];
 if(p.props!==false)stamp('prop',ends[2],a.prop*1.6-.2,spec?.parts.prop.stageScale||.30);
 const line=(a,b,w=1)=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineWidth=w;ctx.strokeStyle='#68482f';ctx.stroke();};
 if((p.rig||'strings')==='strings'){const top=-(y+a.lift*scale)/scale+34;line([-42,top],[42,top],2.2);ends.forEach((end,i)=>line([(THREAD_COLUMNS[i]-2)*19,top],end));}
 if(p.rig==='rods')for(const end of [head,ends[1],ends[2]])line(end,[end[0]-25,(height-y)/scale+8],1.6);
 ctx.restore();if(!p.hideLabel){ctx.save();ctx.textAlign='center';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillStyle='#513629';ctx.fillText((p.slot+1)+' · '+design.name,x,Math.min(height-42,y+145*scale));ctx.restore();}const sx=scale*puppetTurn(p,a.turn);return {x,y,scale,grips:{left:[x+ends[1][0]*sx,y+(a.lift+ends[1][1])*scale],right:[x+ends[2][0]*sx,y+(a.lift+ends[2][1])*scale]}};
}
