import {measureThumb} from './thumb-control.mjs';
import {graspFeatures} from './grasp.mjs';
import {handGeometry,handBox,boxIoU,rememberIdentity,matchIdentity,updateFacing} from './hand-identity.mjs';
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export function mapPoint(p, bounds = {left:.1, right:.9, top:.15, bottom:.85}, mirror = true) {
  const x = mirror ? 1-p.x : p.x;
  return {x:clamp((x-bounds.left)/(bounds.right-bounds.left)), y:clamp((p.y-bounds.top)/(bounds.bottom-bounds.top))};
}
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function gripIntent(fingers){
  if(!Array.isArray(fingers)||fingers.length!==4||fingers.some(v=>v!==null&&!Number.isFinite(v)))return {closed:false,open:false};
  const known=fingers.filter(Number.isFinite);if(known.length<3)return {closed:false,open:false};const average=known.reduce((a,b)=>a+b,0)/known.length;
  return {closed:average<.43&&known.filter(v=>v<.55).length>=3,open:average>.68&&known.filter(v=>v>.65).length>=3};
}
export function describeHand(points, handedness = '', aspect = 4/3, world = null) {
  if (points.length !== 21 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const validWorld=world?.length===21&&world.every(v=>[v.x,v.y,v.z].every(Number.isFinite));
  const p = validWorld?world:points.map(v => ({x:v.x*aspect,y:v.y,z:(v.z||0)*aspect}));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
  const center = [0,5,9,13,17].reduce((v,i)=>({x:v.x+points[i].x/5,y:v.y+points[i].y/5}),{x:0,y:0});
  const size = Math.max(.0001,distance(p[5],p[17]));
  const fingers = [5,9,13,17].map(i => {
    const a={x:p[i].x-p[i+1].x,y:p[i].y-p[i+1].y,z:(p[i].z||0)-(p[i+1].z||0)},b={x:p[i+3].x-p[i+1].x,y:p[i+3].y-p[i+1].y,z:(p[i+3].z||0)-(p[i+1].z||0)};
    const angle=Math.acos(clamp((a.x*b.x+a.y*b.y+a.z*b.z)/(Math.hypot(a.x,a.y,a.z)*Math.hypot(b.x,b.y,b.z)||1),-1,1));
    return clamp((angle-1.3)/1.5);
  });
  const pinch=distance(p[4],p[8])/size;
  const thumbMetrics=measureThumb(p);
  const imagePalm=Math.hypot((points[5].x-points[17].x)*aspect,points[5].y-points[17].y);
  const palmShape=[distance(p[0],p[5]),distance(p[0],p[9]),distance(p[0],p[13]),distance(p[0],p[17])].map(v=>v/size);
  const geometry=handGeometry(p);
  const gripFingers=graspFeatures(p,points,geometry.palmFacing);
  return {...center, size:imagePalm, handedness, points, fingers, gripFingers, ...thumbMetrics, palmShape, ...geometry,
    boneShape:validWorld?geometry.boneShape:null,box:handBox(points),pinch, fist:fingers.every(v=>v<.3),features:[...fingers,clamp(pinch/2)],featureSpace:validWorld?'world3d':'image3d'};
}

// Exact small assignment (<=10 detections). An unmatched option prevents forced teleports.
export function assign(costs, miss = .22) {
  const memo=new Map();
  function search(i,mask) {
    if(i===costs.length)return {cost:0,pairs:[]};
    const key=i+':'+mask;if(memo.has(key))return memo.get(key);
    let next=search(i+1,mask),best={cost:miss+next.cost,pairs:[-1,...next.pairs]};
    for(let j=0;j<costs[i].length;j++)if(!(mask&(1<<j))&&Number.isFinite(costs[i][j])){
      next=search(i+1,mask|(1<<j));const cost=costs[i][j]+next.cost;
      if(cost<best.cost)best={cost,pairs:[j,...next.pairs]};
    }
    memo.set(key,best);return best;
  }
  return search(0,0).pairs;
}

export class HandTracker {
  constructor(limit=10,options={}){this.limit=limit;this.tracks=[];this.nextId=1;this.entryMs=options.entryMs||0;this.gestureHoldMs=options.gestureHoldMs||0;this.recoveryMs=options.recoveryMs??8000;this.unassigned=0;}
  reset(){this.tracks=[];this.unassigned=0;}
  create(d,slot,now){const grip=gripIntent(d.gripFingers??d.fingers),t={...d,id:this.nextId++,slot,identityHand:d.handedness||'',vx:0,vy:0,lastSeen:now,bornAt:now,confirmed:this.entryMs===0,state:this.entryMs?'candidate':'tracked',grasping:this.gestureHoldMs===0&&grip.closed,handOpen:grip.open,pinched:this.gestureHoldMs===0&&(d.intentPinch??d.pinch<.28),fist:this.gestureHoldMs===0&&(d.intentFist??d.fist)};rememberIdentity(t,d,now);updateFacing(t,d,now);return t;}
  bind(d,slot,now){
    // Explicit user claim, never an automatic slot handoff.
    this.tracks.forEach(t=>{if(t.slot!==slot&&dist(t,d)<.08){t.lastSeen=-Infinity;t.state='dormant';t._manualOnly=true;t._identity={};}});
    let t=this.tracks.find(t=>t.slot===slot);
    if(!t){t=this.create(d,slot,now);this.tracks.push(t);}
    Object.keys(t).filter(k=>k.startsWith('_')).forEach(k=>delete t[k]);
    Object.assign(t,d,{identityHand:d.handedness||'',lastSeen:now,bornAt:now,vx:0,vy:0,confirmed:true,state:'tracked',pinched:false,fist:false,grasping:false,handOpen:gripIntent(d.gripFingers??d.fingers).open,facing:1});
    rememberIdentity(t,d,now);updateFacing(t,d,now);
    return t;
  }
  update(input,now){
    const detections=input.slice(0,this.limit);
    // Confirmed identities reserve their slot until an explicit reset, including long absence.
    this.tracks=this.tracks.filter(t=>t.confirmed||now-t.lastSeen<600);
    const ambiguous=new Set();
    detections.forEach((a,i)=>detections.forEach((b,j)=>{if(i!==j&&dist(a,b)<Math.max(.055,Math.min(a.size||.1,b.size||.1)*.7)){ambiguous.add(i);ambiguous.add(j);}}));
    const recovery=new Set();
    const costs=this.tracks.map((t,i)=>detections.map((d,j)=>{
      if(ambiguous.has(j)||t._manualOnly)return Infinity;
      const age=now-t.lastSeen,dt=Math.min(.3,age/1000),pred={x:t.x+t.vx*dt,y:t.y+t.vy*dt};
      const distance=dist(pred,d);
      const remembered=Object.values(t._identity||{}).some(p=>p.samples>=4);
      const turning=Number.isFinite(t.palmFacing)&&Number.isFinite(d.palmFacing)&&(Math.abs(t.palmFacing)<.65||t.palmFacing*d.palmFacing<0||now-(t._turnAt??-Infinity)<1100);
      const sameMotion=(!t.motionId&&!d.motionId)||(t.motionId&&t.motionId===d.motionId);
      const unique=this.tracks.every((other,k)=>k===i||dist(other,d)>.22)&&detections.every((other,k)=>k===j||dist(other,t)>.22);
      const shortTurn=age<=1000&&distance<.12&&turning&&sameMotion&&unique;
      // Long absence or a return in another part of the frame needs identity evidence,
      // not the old position. The reference survives for this camera session.
      if(age>350&&remembered&&!shortTurn||age>this.recoveryMs||distance>.32){
        const identity=matchIdentity(t,d);
        if(!identity?.accepted)return Infinity;
        recovery.add(i+':'+j);return .06+identity.score*.6;
      }
      // A continuous 3D observation may change the detector's handedness during a flip.
      if(t.identityHand&&d.handedness&&t.identityHand!==d.handedness&&!(shortTurn||age<=350&&distance<.16&&Number.isFinite(d.palmFacing)&&Number.isFinite(t.palmFacing)))return Infinity;
      const shape=t.palmShape&&d.palmShape?t.palmShape.reduce((s,v,k)=>s+Math.abs(v-d.palmShape[k]),0)/t.palmShape.length:0;
      const scale=Math.abs(Math.log((d.size||.1)/(t.size||.1)));
      const rotating=Number.isFinite(d.palmFacing)&&Number.isFinite(t.palmFacing)&&(Math.abs(d.palmFacing)<.6||Math.abs(t.palmFacing)<.6||d.palmFacing*t.palmFacing<0);
      const motion=t.motionId&&d.motionId?(t.motionId===d.motionId?-.04:.07):0;
      return distance>(age>350?.32:.22)||(!rotating&&(scale>.8||shape>.6)) ? Infinity : Math.max(0,distance+Math.min(.06,shape*.1)+(rotating?0:Math.min(.04,scale*.04))+ (t.box&&d.box?.right? .015*(1-boxIoU(t.box,d.box)):0)+motion);
    }));
    const pairs=assign(costs,.36),used=new Set(),uncertain=new Set();
    // A nearly tied association cannot transfer ownership. Freeze both and wait for separation.
    pairs.forEach((j,i)=>{if(j<0)return;const c=costs[i][j];
      if(costs[i].some((v,k)=>k!==j&&Math.abs(v-c)<.035)||costs.some((row,k)=>k!==i&&Math.abs(row[j]-c)<.035)){
        uncertain.add(i);costs.forEach((row,k)=>{if(Number.isFinite(row[j])&&Math.abs(row[j]-c)<.035)uncertain.add(k);});
      }
    });
    this.tracks.forEach((t,i)=>{
      const j=pairs[i];
      if(j<0||uncertain.has(i)){this.hold(t,now);t._recovery=null;return;}
      const d=detections[j],reidentifying=recovery.has(i+':'+j);
      if(reidentifying){
        const pending=t._recovery;
        if(!pending||now-pending.last>180||dist(pending,d)>.13)t._recovery={x:d.x,y:d.y,since:now,last:now,frames:1};
        else Object.assign(pending,{x:d.x,y:d.y,last:now,frames:pending.frames+1});
        if(now-t._recovery.since<220||t._recovery.frames<3){used.add(j);this.hold(t,now);t.recovering=true;return;}
        t.recoveries=(t.recoveries||0)+1;
      }
      used.add(j);const age=now-t.lastSeen,dt=Math.max(.016,age/1000);
      t.vx=reidentifying?0:clamp(.65*t.vx+.35*(d.x-t.x)/dt,-2,2);t.vy=reidentifying?0:clamp(.65*t.vy+.35*(d.y-t.y)/dt,-2,2);
      const previousFist=t.fist,previousPinch=t.pinched,previousFingers=t.fingers,previousThumb=t.thumb;
      if(Number.isFinite(d.palmFacing)&&(Math.abs(d.palmFacing)<.65||Number.isFinite(t.palmFacing)&&d.palmFacing*t.palmFacing<0))t._turnAt=now;
      if(now-t.lastSeen>250&&!t.confirmed)t.bornAt=now;
      Object.assign(t,d,{lastSeen:now});
      t._recovery=null;t.recovering=false;updateFacing(t,d,now);
      t.confirmed=t.confirmed||now-t.bornAt>=this.entryMs;t.state=t.confirmed?'tracked':'candidate';
      if(t.confirmed)rememberIdentity(t,d,now);
      t.fingers=d.fingers.map((v,k)=>smooth(previousFingers?.[k]??v,v,dt*1000,45));
      t.thumb=smooth(previousThumb??d.thumb??.5,d.thumb??.5,dt*1000,40);
      t.pinched=previousPinch;t.fist=previousFist;
      this.confirmGesture(t,'pinch',d.intentPinch??(t.pinched?d.pinch<.45:d.pinch<.28),now);
      this.confirmGesture(t,'fist',d.intentFist??d.fist,now);
      const grip=gripIntent(d.gripFingers??d.fingers);this.confirmGesture(t,'grasping',grip.closed,now);this.confirmGesture(t,'handOpen',grip.open,now);
      if(!grip.closed)t.grasping=false;if(!grip.open)t.handOpen=false;
    });
    this.unassigned=0;
    const missingOwners=this.tracks.filter((t,i)=>pairs[i]<0||uncertain.has(i));
    detections.forEach((d,i)=>{
      if(used.has(i))return;
      if(ambiguous.has(i)||this.tracks.length>=this.limit){this.unassigned++;return;}
      // Missing owners and changed handedness must not produce duplicate puppets.
      if(missingOwners.some(t=>!t._manualOnly&&(dist(t,d)<.4||Object.keys(t._identity||{}).length||t.state==='dormant'&&(!t.identityHand||t.identityHand===d.handedness)))||uncertain.size){this.unassigned++;return;}
      const occupied=new Set(this.tracks.map(t=>t.slot));let slot=0;while(occupied.has(slot))slot++;
      this.tracks.push(this.create(d,slot,now));
    });
    return this.tracks;
  }
  hold(t,now){t.state=now-t.lastSeen>this.recoveryMs?'dormant':now-t.lastSeen>350?'lost':'hold';t.recovering=false;t._faceCandidate=null;t._pinchSince=now;t._fistSince=now;t._graspingSince=now;t._handOpenSince=now;t.pinched=false;t.fist=false;t.grasping=false;t.handOpen=false;}
  confirmGesture(t,name,value,now){const candidate='_'+name+'Candidate',since='_'+name+'Since',field=name==='pinch'?'pinched':name;if(t[candidate]!==value){t[candidate]=value;t[since]=now;}if(now-t[since]>=this.gestureHoldMs)t[field]=value;}
}

export function smooth(current,target,dtMs,tauMs=65){
  return current+(target-current)*(1-Math.exp(-Math.max(0,dtMs)/tauMs));
}
export const targetPositions = [{x:.23,y:.40},{x:.72,y:.30},{x:.52,y:.72},{x:.82,y:.68},{x:.35,y:.60}];
