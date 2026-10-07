export const SCENE_KEY='shadow-stage-layout-v1';
export const PROP_TYPES={
 fan:{name:'芭蕉扇',w:100,h:143,kind:'carry',gripY:.39,hint:'握住扇柄拿起，张手放下'},
 umbrella:{name:'油纸伞',w:160,h:152,kind:'carry',gripY:.33,hint:'拿起雨伞，和同伴一起走'},
 ring:{name:'救生圈',w:90,h:90,kind:'carry',hint:'拿到同伴身边，放下后让同伴接过'},
 table:{name:'花纹长桌',w:230,h:106,kind:'surface',hint:'小物件松手后可放上桌面'},
 bridge:{name:'石拱桥',w:252,h:153,kind:'set',hint:'摆在幕布上，编一段过桥的戏'},
 drum:{name:'大鼓',w:114,h:120,kind:'trigger',touchY:-.23,hint:'手靠近后收拢手指，鼓面会回应'},
 lantern:{name:'花灯',w:54,h:130,kind:'carry',gripY:-.43,hint:'收拢手指拿起，张手放下'},
 peach:{name:'仙桃',w:66,h:59,kind:'carry',hint:'握住后搬运，也能放在桌上'},
 ball:{name:'花球',w:54,h:54,kind:'carry',hint:'拿起后搬运，放下会弹一下'},
 butterfly:{name:'蝴蝶',w:75,h:61,kind:'carry',hint:'带着它飞，张手把它停下'},
 pinwheel:{name:'风车',w:83,h:126,kind:'trigger',touchY:-.22,hint:'手靠近后收拢手指，让风车转起来'}
};
export const BACKGROUNDS={moon:'月下山水',forest:'花果山',lotus:'荷塘',lantern:'灯市',sea:'海边',rain:'雨中小路'};
const piece=(type,x,y)=>({type,x,y});
export const SETS={
 chineseStory:{name:'语文 · 花果山编故事',background:'forest',items:[piece('table',555,486),piece('peach',550,407),piece('bridge',250,487)]},
 chineseMoon:{name:'语文 · 月下神话与节日',background:'moon',items:[piece('table',690,490),piece('lantern',690,366),piece('bridge',300,482)]},
 chineseRain:{name:'语文 · 雨中桥边相遇',background:'rain',items:[piece('bridge',270,485),piece('umbrella',690,370)]},
 chinesePractice:{name:'语文 · 灯下操偶练习',background:'lantern',items:[piece('table',690,490),piece('lantern',455,370)]},
 chinesePortrait:{name:'语文 · 人物特写',background:'lantern',items:[piece('table',740,485),piece('fan',555,368),piece('lantern',750,352)]},
 chineseFestival:{name:'语文 · 合作展演',background:'lantern',items:[piece('table',550,487),piece('ball',538,405),piece('lantern',290,371),piece('drum',830,466)]},
 chineseVillage:{name:'语文 · 风俗介绍',background:'moon',items:[piece('bridge',300,490),piece('table',740,485),piece('lantern',680,363),piece('drum',450,470)]},
 dramaMoon:{name:'英语戏 · 月下送灯',background:'moon',items:[piece('table',690,490),piece('lantern',690,366)]},
 dramaBridge:{name:'英语戏 · 桥边寻灯',background:'moon',items:[piece('bridge',330,482),piece('table',760,486),piece('lantern',495,400)]},
 dramaPeach:{name:'英语戏 · 森林分桃',background:'forest',items:[piece('table',555,486),piece('peach',550,407),piece('lantern',750,376)]},
 dramaRain:{name:'英语戏 · 雨天借伞',background:'rain',items:[piece('bridge',270,485),piece('umbrella',690,370)]},
 dramaSea:{name:'英语戏 · 海边救援',background:'sea',items:[piece('table',290,492),piece('ring',350,386)]},
 dramaFan:{name:'英语戏 · 花果山借扇',background:'forest',items:[piece('table',620,490),piece('fan',620,368),piece('peach',310,455)]},
 mountain:{name:'山前练功',background:'forest',items:[piece('bridge',250,487),piece('table',554,482),piece('peach',530,400),piece('drum',850,477)]},
 lotus:{name:'荷塘追光',background:'lotus',items:[piece('bridge',400,488),piece('lantern',700,378),piece('butterfly',470,330),piece('pinwheel',240,412)]},
 play:{name:'一起玩花球',background:'lantern',items:[piece('table',730,485),piece('ball',440,426),piece('pinwheel',235,429),piece('lantern',754,352)]},
 moon:{name:'月下送灯',background:'moon',items:[piece('bridge',300,490),piece('table',740,485),piece('lantern',680,363),piece('butterfly',470,321)]},
 heroes:{name:'小将出场',background:'forest',items:[piece('drum',300,465),piece('bridge',780,490),piece('lantern',535,373)]},
 festival:{name:'灯会碰面',background:'lantern',items:[piece('table',550,487),piece('ball',538,405),piece('lantern',290,371),piece('drum',830,466),piece('pinwheel',160,426)]}
};
export function recommendSet(characters){const ids=new Set(characters);if(!ids.size)return null;const all=(...v)=>v.some(id=>ids.has(id));const groups=new Set();if(all('wukong','nezha','bajie','erlang','mulan'))groups.add('hero');if(all('bluey','doraemon','kuromi','student'))groups.add('play');if(all('yutu','kanao','change'))groups.add('moon');if(groups.size>1)return 'festival';if(groups.has('play'))return 'play';if(groups.has('moon'))return 'moon';if(all('wukong','bajie'))return 'mountain';if(ids.has('nezha'))return 'lotus';return 'heroes';}
export const ownerKey=p=>(p.id==null?'pointer':'hand-'+p.id)+'-slot-'+p.slot;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const clone=v=>JSON.parse(JSON.stringify(v));
function validPoint(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1100&&y>=0&&y<=650;}
export function validateLayout(raw){
 if(!raw||raw.version!==1||!SETS[raw.preset]||!['auto',...Object.keys(BACKGROUNDS)].includes(raw.background)||typeof raw.auto!=='boolean'||!Array.isArray(raw.items)||raw.items.length>12)throw Error('布景资料不完整。');
 const ids=new Set();const items=raw.items.map(i=>{if(!i||!PROP_TYPES[i.type]||!Number.isSafeInteger(i.id)||i.id<1||ids.has(i.id)||!validPoint(i.x,i.y))throw Error('道具资料不正确。');ids.add(i.id);return {id:i.id,type:i.type,x:i.x,y:i.y};});
 return {version:1,preset:raw.preset,background:raw.background,auto:raw.auto,items};
}
export class StageScene{
 constructor(saved=null){this.items=[];this.nextId=1;this.auto=true;this.background='auto';this.preset='mountain';this.selected=null;this.hands=new Map();this.recommendation=null;this.candidate=null;this.candidateAt=0;this.appliedAt=-Infinity;this.message='靠近小物件，收拢手指拿起；张手放下。';this.revision=0;
  if(saved){const v=validateLayout(saved);Object.assign(this,v);this.nextId=Math.max(0,...this.items.map(i=>i.id))+1;}else this.apply('mountain',0);
 }
 get backgroundId(){return this.background==='auto'?SETS[this.preset].background:this.background;}
 changed(text){this.revision++;if(text)this.message=text;}
 serialize(){return validateLayout({version:1,preset:this.preset,background:this.background,auto:this.auto,items:this.items.map(({id,type,x,y})=>({id,type,x:clamp(x,0,1100),y:clamp(y,0,650)}))});}
 apply(id,now=0){if(!SETS[id])return;this.preset=id;this.items=SETS[id].items.map(p=>({...p,id:this.nextId++}));this.selected=null;this.hands.clear();this.appliedAt=now;this.changed('已布置“'+SETS[id].name+'”。');}
 observe(characters,now){const target=recommendSet(characters);this.recommendation=target;if(target!==this.candidate){this.candidate=target;this.candidateAt=now;}if(this.auto&&target&&target!==this.preset&&now-this.candidateAt>=1800&&now-this.appliedAt>=8000&&!this.items.some(i=>i.owner))this.apply(target,now);}
 manual(){this.auto=false;}
 add(type){if(!PROP_TYPES[type])return null;if(this.items.length>=12){this.changed('舞台已有 12 件道具。先移走一件再添加。');return null;}this.manual();const i={id:this.nextId++,type,x:360+(this.items.length%4)*105,y:360+Math.floor(this.items.length/4)*60};this.items.push(i);this.selected=i.id;this.move(i.id,i.x,i.y);this.changed('已添加'+PROP_TYPES[type].name+'。打开“摆道具”可拖动。');return i;}
 move(id,x,y){const i=this.items.find(i=>i.id===id);if(!i||i.owner)return false;const d=PROP_TYPES[i.type],old={x:i.x,y:i.y};i.x=clamp(x,55+d.w/2,1045-d.w/2);i.y=clamp(y,80+d.h/2,590-d.h/2);for(const child of this.items.filter(p=>p.support===id)){child.x+=i.x-old.x;child.y+=i.y-old.y;}i.support=null;this.manual();this.revision++;return true;}
 remove(id){const i=this.items.find(i=>i.id===id);if(!i)return;this.items=this.items.filter(i=>i.id!==id);for(const child of this.items)if(child.support===id)child.support=null;this.selected=null;this.manual();this.changed('已移走'+PROP_TYPES[i.type].name+'。可重新添加。');}
 clear(){this.items=[];this.hands.clear();this.selected=null;this.manual();this.changed('舞台道具已清空。人物和背景保留。');}
 hit(x,y){return [...this.items].reverse().find(i=>!i.owner&&Math.abs(x-i.x)<=PROP_TYPES[i.type].w/2+5&&Math.abs(y-i.y)<=PROP_TYPES[i.type].h/2+5)||null;}
 held(p){return this.items.find(i=>i.owner===ownerKey(p));}
 target(i){const d=PROP_TYPES[i.type];return [i.x,i.y+(d.gripY??d.touchY??0)*d.h];}
 nearby(p){if(!p?.grips)return null;const options=[];for(const i of this.items){if(i.owner||!['carry','trigger'].includes(PROP_TYPES[i.type].kind))continue;const point=this.target(i);for(const side of ['left','right']){const grip=p.grips[side];if(!grip)continue;const distance=Math.hypot(grip[0]-point[0],grip[1]-point[1]);if(distance<=64)options.push({item:i,side,distance});}}return options.sort((a,b)=>a.distance-b.distance||a.item.id-b.item.id)[0]||null;}
 interact(p,now,latched=false,candidate=null){if(!p||p.state!=='tracked'){this.changed('先让所选角色清晰入场。');return false;}if(this.held(p)){this.drop(this.held(p),now);return true;}const near=candidate||this.nearby(p);if(!near||near.item.owner||!this.items.includes(near.item)){this.changed('把人物的手移近花灯、花球或鼓，再试一次。');return false;}const {item:i,side}=near,d=PROP_TYPES[i.type];if(d.kind==='carry'){i.owner=ownerKey(p);i.side=side;i.support=null;i.lastSeen=now;i.latched=latched;this.follow(i,p);this.changed('角色 '+(p.slot+1)+' 拿起了'+d.name+(latched?'。点击“放下”归还，或握住再张手。':'。张手放下。'));}else{if(now-(i.triggerAt??-Infinity)<900)return false;i.triggerAt=now;i.count=(i.count||0)+1;this.changed(d.name+'动了 · 第 '+i.count+' 次');}return true;}
 follow(i,p){const grip=p.grips?.[i.side];if(!grip)return;i.x=grip[0];i.y=grip[1]-(PROP_TYPES[i.type].gripY||0)*PROP_TYPES[i.type].h;}
 drop(i,now){if(!i)return;const d=PROP_TYPES[i.type];i.owner=null;i.side=null;i.openSince=null;const table=this.items.filter(t=>PROP_TYPES[t.type].kind==='surface').find(t=>Math.abs(i.x-t.x)<PROP_TYPES[t.type].w*.43&&Math.abs(i.y+d.h/2-(t.y-PROP_TYPES[t.type].h*.46))<75);if(table){i.y=table.y-PROP_TYPES[table.type].h*.46-d.h/2;i.support=table.id;}else{i.x=clamp(i.x,60+d.w/2,1040-d.w/2);i.y=clamp(i.y,80+d.h/2,587-d.h/2);}i.droppedAt=now;this.changed('放下'+d.name+(table?'，落在长桌上。':'。'));}
 releaseAll(now){for(const i of this.items)if(i.owner)this.drop(i,now);this.hands.clear();}
 update(actors,now,interactive=true){
  const byId=new Map(actors.map(p=>[ownerKey(p),p]));
  for(const i of this.items.filter(i=>i.owner)){const p=byId.get(i.owner);if(p?.state==='tracked'){i.lastSeen=now;this.follow(i,p);if(p.grasping)i.latched=false;const opened=p.handOpen??!p.pinched;if(interactive&&!i.latched&&opened){i.openSince??=now;if(now-i.openSince>=180)this.drop(i,now);}else i.openSince=null;}else{ i.openSince=null;if(now-(i.lastSeen??now)>8000)this.drop(i,now);}}
  for(const p of actors){
   const key=ownerKey(p),s=this.hands.get(key)||{armed:false,since:null};this.hands.set(key,s);
   if(!interactive||p.state!=='tracked'){s.since=null;if(!interactive||now-(s.lastTracked??-Infinity)>1000){s.armed=false;s.near=null;}continue;}
   s.lastTracked=now;
   const closed=p.grasping??p.pinched,opened=p.handOpen??!p.pinched;
   if(opened){s.armed=true;s.since=null;const near=this.nearby(p);if(near)s.near={...near,at:now,facing:p.facing??1};else if(s.near&&now-s.near.at>1400)s.near=null;continue;}
   if(!closed){s.since=null;continue;}
   if(s.armed&&!this.held(p)){
    s.since??=now;
    if(now-s.since>=220){
     // Closing fingers moves the puppet's arm. Remember the object approached while open.
     let near=null;
     if(p.grasping&&s.near&&!s.near.item.owner&&now-s.near.at<1400){const target=this.target(s.near.item),candidates=['left','right'].map(side=>({side,grip:p.grips?.[side]})).filter(v=>v.grip).map(v=>({...v,distance:Math.hypot(v.grip[0]-target[0],v.grip[1]-target[1])})).sort((a,b)=>a.distance-b.distance);const sameFace=(p.facing??1)===(s.near.facing??1),original=candidates.find(v=>v.side===s.near.side),grip=sameFace&&original?.distance<130?original:candidates[0];if(grip?.distance<130)near={...s.near,side:grip.side};}
     near??=this.nearby(p);
     if(near){this.interact(p,now,false,near);s.armed=false;s.since=null;s.near=null;}
    }
   }
  }
  for(const key of this.hands.keys())if(!byId.has(key)&&!this.items.some(i=>i.owner===key))this.hands.delete(key);
 }
 snapshot(){return {...this.serialize(),backgroundId:this.backgroundId,items:clone(this.items),selected:this.selected,recommendation:this.recommendation,message:this.message};}
}
