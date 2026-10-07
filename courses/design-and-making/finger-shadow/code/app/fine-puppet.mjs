import {fingerPose,THREAD_COLUMNS} from './finger-map.mjs';
import {actionPose} from './actions.mjs';
import {puppetTurn} from './hand-identity.mjs';
import {CHANGE_SHEET} from './change-art.mjs';
// Original generated sprite sheets stay intact. Source regions are sampled only while rendering.
const sheets={
 change:CHANGE_SHEET,
 yutu:{file:'yutu-atlas-v3.png',k:.21,headK:.2,armK:[.18,.18],legK:[.18,.18],root:[659,238],body:[483,0,388,469],head:[0,0,481,468],neck:[652,42],headPivot:[332,421],shoulders:[[551,84],[768,86]],hips:[[560,405],[769,405]],arms:[[[907,0,346,469],[1060,49]],[[0,473,477,421],[224,513]]],legs:[[[483,473,388,421],[631,520]],[[883,473,370,421],[1037,516]]],props:[[0,895,477,358],[483,895,388,358],[883,895,370,358]],names:['捣药杵','月饼','花灯']},
 bajie:{file:'bajie-atlas-v3.png',k:.22,headK:.19,armK:[.19,.19],legK:[.2,.2],root:[657,217],body:[452,0,414,443],head:[0,0,449,438],neck:[637,51],headPivot:[286,384],shoulders:[[539,93],[745,101]],hips:[[533,382],[782,390]],arms:[[[885,0,368,442],[1066,51]],[[0,440,448,422],[237,481]]],legs:[[[449,444,416,417],[638,474]],[[866,444,387,417],[1029,476]]],props:[[0,864,441,389],[449,863,409,390],[860,863,393,390]],names:['九齿钉耙','西瓜','行囊']},
 erlang:{file:'erlang-atlas-v3.png',k:.22,headK:.19,armK:[.18,.18],legK:[.19,.19],root:[640,238],body:[442,0,413,461],head:[0,0,440,464],neck:[641,46],headPivot:[324,415],shoulders:[[521,99],[760,98]],hips:[[503,370],[780,370]],arms:[[[866,0,387,463],[1059,37]],[[0,464,440,438],[224,496]]],legs:[[[442,464,413,438],[621,493]],[[857,464,396,438],[1047,492]]],props:[[0,904,426,349],[430,904,422,349],[855,904,398,349]],names:['三尖两刃刀','哮天犬','祥云']},
 mulan:{file:'mulan-atlas-v3.png',k:.24,headK:.21,armK:[.19,.19],legK:[.19,.19],root:[639,226],body:[449,0,405,420],head:[0,0,446,419],neck:[638,36],headPivot:[324,316],shoulders:[[531,89],[735,88]],hips:[[531,332],[773,334]],arms:[[[861,0,392,420],[1027,32]],[[0,421,446,420],[231,447]]],legs:[[[449,421,405,420],[646,447]],[[858,421,395,420],[1028,447]]],props:[[0,843,441,410],[449,843,405,410],[858,843,395,410]],names:['佩刀（带鞘）','盾牌','战旗']},
 wukong:{root:[330,330],cut:253,body:[0,253,452,240],head:[0,0,452,253],neck:[336,253],shoulders:[[235,265],[414,265]],hips:[[283,446],[386,446]],arms:[[[501,0,253,489],[655,37]],[[917,0,261,489],[993,39]]],legs:[[[79,489,287,477],[219,514]],[[521,489,305,477],[625,513]]],props:[[995,488,105,473],[18,978,384,275],[446,989,386,263]],names:['金箍棒','仙桃','筋斗云']},
 nezha:{root:[350,364],cut:224,body:[0,224,590,306],head:[0,0,590,224],neck:[351,224],shoulders:[[284,254],[412,254]],hips:[[304,500],[399,500]],arms:[[[600,0,205,504],[661,58]],[[911,0,210,504],[1056,57]]],legs:[[[70,522,320,390],[225,544]],[[476,522,321,390],[600,543]]],props:[[850,545,392,369],[40,915,395,337],[430,921,400,332]],names:['乾坤圈','风火轮','混天绫']},
};
// Attachment tabs are hidden under the collar, not stacked into a second neck.
// The v2 combined head/body sheets already share a seam and need no overlap.
const collarFits={yutu:{neckY:77},bajie:{neckY:91,bodyTop:66},erlang:{neckY:86,bodyTop:66},mulan:{neckY:76,bodyTop:56},change:{neckY:87}};
// Atlas neighbours approach the upper-left edge; retain the wide lower cloak.
const images=new Map();
export const fineArtReady=typeof Image==='undefined'?Promise.resolve():Promise.all(Object.keys(sheets).map(id=>new Promise(resolve=>{const im=new Image();im.onload=()=>{images.set(id,im);resolve();};im.onerror=resolve;im.src=new URL('../assets/generated/'+(sheets[id].file||id+'-atlas-v2.png'),import.meta.url).href;})));
export function fineArtIds(){return [...images.keys()];}
export function propsFor(id){return sheets[id]?.names||['随身道具'];}
export function designArtSpec(id){
 const sheet=sheets[id];if(!sheet)return null;const fit=collarFits[id],body=fit?.bodyTop?[sheet.body[0],fit.bodyTop,sheet.body[2],sheet.body[1]+sheet.body[3]-fit.bodyTop,sheet.body[4]]:sheet.body;
 const k=sheet.k||.235,rects={head:[sheet.head,sheet.headPivot||sheet.neck,sheet.headK||k],body:[body,sheet.root,k],leftArm:[...sheet.arms[0],sheet.armK?.[0]||k],rightArm:[...sheet.arms[1],sheet.armK?.[1]||k],leftLeg:[...sheet.legs[0],sheet.legK?.[0]||k],rightLeg:[...sheet.legs[1],sheet.legK?.[1]||k],prop:[sheet.props[0],sheet.propPivots?.[0]||[sheet.props[0][0]+sheet.props[0][2]/2,sheet.props[0][1]+sheet.props[0][3]/2],sheet.propScales?.[0]||.18]};
 const parts={};for(const [name,[rect,pivot,stageScale]] of Object.entries(rects)){const [sx,sy,w,h]=rect,scale=Math.min(216/w,272/h),offset=[(256-w*scale)/2,(320-h*scale)/2],map=([x,y])=>[offset[0]+(x-sx)*scale,offset[1]+(y-sy)*scale];const index=['leftArm','rightArm'].indexOf(name),legIndex=['leftLeg','rightLeg'].indexOf(name),tip=index>=0?sheet.armTips?.[index]:legIndex>=0?sheet.legTips?.[legIndex]:null;parts[name]={rect,scale,offset,pivot:map(pivot),stageScale:stageScale/scale,tip:map(tip||[pivot[0],sy+h-24]),map};}
 const map=parts.body.map;return {parts,anchors:{head:map([sheet.neck[0],fit?.neckY??sheet.neck[1]]),leftArm:map(sheet.shoulders[0]),rightArm:map(sheet.shoulders[1]),leftLeg:map(sheet.hips[0]),rightLeg:map(sheet.hips[1])},headBehind:!!sheet.headPivot,armsInFront:!!sheet.armsInFront};
}
export function drawDesignArtPart(g,id,name){const image=images.get(id),part=designArtSpec(id)?.parts[name];if(!image||!part)return false;const [sx,sy,w,h,clip]=part.rect,[x,y]=part.offset;g.save();if(clip){g.beginPath();clip.map(part.map).forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.closePath();g.clip();}g.drawImage(image,sx,sy,w,h,x,y,w*part.scale,h*part.scale);g.restore();return true;}
const segment=(g,a,b,color='#705035',width=1)=>{g.beginPath();g.moveTo(...a);g.lineTo(...b);g.strokeStyle=color;g.lineWidth=width;g.stroke();};
function sample(g,img,rect,pivot,x,y,angle=0,k=.235){g.save();g.translate(x,y);g.rotate(angle);const [sx,sy,sw,sh,clip]=rect;if(clip){g.beginPath();clip.forEach(([px,py],i)=>i?g.lineTo((px-pivot[0])*k,(py-pivot[1])*k):g.moveTo((px-pivot[0])*k,(py-pivot[1])*k));g.closePath();g.clip();}g.drawImage(img,sx,sy,sw,sh,(sx-pivot[0])*k,(sy-pivot[1])*k,sw*k,sh*k);g.restore();}
export function drawFinePuppet(ctx,p,width,height,c){
 const im=images.get(c.id),s=sheets[c.id];if(!s)return false;if(!im){ctx.save();ctx.fillStyle='#72543b';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(translateStockLabel((globalThis.__shadowTranslate?.(c.name)||c.name)+' · 素材载入中'),90+p.x*(width-180),150+p.y*(height-245));ctx.restore();return true;}
 const scale=Math.min(width/1100,height/650)*.94,k=s.k||.235,root=s.root,control=fingerPose(p),f=control.limbs,a=actionPose(p.action);
 const x=90*scale+p.x*(width-180*scale),y=150*scale+p.y*(height-245*scale);
 const local=([x,y])=>[(x-root[0])*k,(y-root[1])*k];
 // Half-open controls give a relaxed stance; the upper half still reaches out.
 const armAngle=v=>.04+.32*Math.min(v,.5)*2+1.05*Math.max(0,v-.5)*2;
 const legAngle=v=>.04+(.5-v)*.55;
 const arms=[armAngle(f[0]),-armAngle(f[1])-a.prop*.55],legs=[legAngle(f[2]),-legAngle(f[3])];
 const headAngle=(control.head-.5)*.42;
 const ends=[];
 function limb(part,anchor,angle,index){const [rect,pivot]=part,[px,py]=local(anchor),lk=index<3?(s.armK?.[index-1]||k):(s.legK?.[index-3]||k),tip=index<3?s.armTips?.[index-1]:s.legTips?.[index-3],dx=tip?(tip[0]-pivot[0])*lk:0,dy=(tip?tip[1]-pivot[1]:rect[1]+rect[3]-pivot[1]-24)*lk;sample(ctx,im,rect,pivot,px,py,angle,lk);const end=[px+Math.cos(angle)*dx-Math.sin(angle)*dy,py+Math.sin(angle)*dx+Math.cos(angle)*dy];ends[index]=end;return end;}
 ctx.save();ctx.translate(x,y+a.lift*scale);ctx.scale(scale*puppetTurn(p,a.turn),scale);ctx.globalAlpha=p.state==='lost'||p.state==='dormant'?.3:p.state==='hold'?.65:1;
 const leg1=limb(s.legs[0],s.hips[0],legs[0],3),leg2=limb(s.legs[1],s.hips[1],legs[1],4);
 let left,right;const drawArms=()=>{left=limb(s.arms[0],s.shoulders[0],arms[0],1);right=limb(s.arms[1],s.shoulders[1],arms[1],2);};
 if(!s.armsInFront)drawArms();
 const fit=collarFits[c.id],neck=local([s.neck[0],fit?.neckY??s.neck[1]]);
 const drawHead=()=>sample(ctx,im,s.head,s.headPivot||s.neck,...neck,headAngle,s.headK||k);
 if(s.headPivot)drawHead();
 const body=fit?.bodyTop?[s.body[0],fit.bodyTop,s.body[2],s.body[1]+s.body[3]-fit.bodyTop,s.body[4]]:s.body;
 sample(ctx,im,body,root,0,0,0,k);
 if(!s.headPivot)drawHead();
 if(s.armsInFront)drawArms();
 ends[0]=[neck[0]+Math.sin(headAngle)*40,neck[1]-Math.cos(headAngle)*40];
 if(p.props!==false){const choice=Number(p.propIndex)||0,rect=s.props[choice%3],side=choice===1?left:right;
   let px=side[0],py=side[1],rotation=arms[choice===1?0:1]*.35+a.prop*1.6,sz=.18;
   if(c.id==='wukong'&&choice===0){sz=.3;rotation=-.08+a.prop*2;}
   if(['bajie','erlang','mulan'].includes(c.id)&&choice===0){sz=.28;rotation=a.prop*1.6;}
   if(c.id==='erlang'&&choice===1){px=90;py=Math.max(leg1[1],leg2[1])-20;sz=.2;rotation=0;}
   if(c.id==='nezha'&&choice===1){for(const end of [leg1,leg2])sample(ctx,im,rect,[rect[0]+rect[2]/2,rect[1]+rect[3]/2],end[0],end[1]+9,a.prop*5,.12);sz=0;}
   if(c.id==='wukong'&&choice===2){px=0;py=Math.max(leg1[1],leg2[1])+5;sz=.34;rotation=0;}
   if(sz)sample(ctx,im,rect,s.propPivots?.[choice%3]||[rect[0]+rect[2]/2,rect[1]+rect[3]/2],px,py,rotation,s.propScales?.[choice%3]||sz);
 }
 if(p.pinched){ctx.beginPath();ctx.arc(right[0]+12,right[1]-16,8,0,Math.PI*2);ctx.fillStyle='#ffdb7a';ctx.fill();}
 // The five control threads end at the head, wrists, and ankles, following the moving joints.
 if((p.rig||'strings')==='strings'){
   const top=-(y+a.lift*scale)/scale+34;segment(ctx,[-42,top],[42,top],'#5b3928',2.2);
   ends.forEach((end,i)=>{segment(ctx,[(THREAD_COLUMNS[i]-2)*19,top],end,'#6a4c32',1);ctx.beginPath();ctx.arc(...end,2,0,Math.PI*2);ctx.fillStyle='#dec38d';ctx.fill();});
 }else if(p.rig==='rods'){for(const end of [neck,left,right])segment(ctx,end,[end[0]-25,(height-y)/scale+8],'#72553b',1.6);}
 ctx.restore();
 if(!p.hideLabel){ctx.save();ctx.fillStyle='#513629';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(translateStockLabel((p.slot+1)+' · '+(globalThis.__shadowTranslate?.(c.name)||c.name)+(p.id?' / 手 '+p.id:'')),x,Math.min(height-42,y+145*scale));ctx.restore();}
 const sx=scale*puppetTurn(p,a.turn);
 return {x,y,scale,grips:{left:[x+left[0]*sx,y+(a.lift+left[1])*scale],right:[x+right[0]*sx,y+(a.lift+right[1])*scale]}};
}

function translateStockLabel(value){return globalThis.__shadowTranslate?.(value)||value;}
