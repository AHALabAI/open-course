// Session-local hand descriptors. These are association clues, not biometric identification.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const bones=[[0,5],[0,9],[0,13],[0,17],[5,9],[9,13],[13,17],
  [1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];
export function handGeometry(p){
  const a=[p[5].x-p[0].x,p[5].y-p[0].y,(p[5].z||0)-(p[0].z||0)];
  const b=[p[17].x-p[0].x,p[17].y-p[0].y,(p[17].z||0)-(p[0].z||0)];
  const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const n=Math.hypot(...normal),lengths=bones.map(([i,j])=>distance(p[i],p[j]));
  const base=(lengths[0]+lengths[1]+lengths[2]+lengths[3])/4;
  return {palmFacing:n>1e-8?normal[2]/n:null,
    boneShape:base>1e-5&&lengths.every(v=>v>1e-6)?lengths.map(v=>v/base):null};
}
export function handBox(points){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  return {left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
}
export function boxIoU(a,b){
  if(!a||!b)return 0;
  const area=r=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
  const intersection=area({left:Math.max(a.left,b.left),right:Math.min(a.right,b.right),top:Math.max(a.top,b.top),bottom:Math.min(a.bottom,b.bottom)});
  return intersection/(area(a)+area(b)-intersection||1);
}

// Sample only the inner palm polygon, at low resolution. No pixels leave the worker.
export function palmAppearance(rgba,width,height,points){
  const ids=[0,5,9,13,17],center=ids.reduce((v,i)=>({x:v.x+points[i].x/5,y:v.y+points[i].y/5}),{x:0,y:0});
  const polygon=ids.map(i=>({x:(center.x+(points[i].x-center.x)*.7)*width,y:(center.y+(points[i].y-center.y)*.7)*height}));
  const box=handBox(polygon),hist=Array(24).fill(0);let count=0;
  for(let y=Math.max(0,Math.floor(box.top));y<Math.min(height,Math.ceil(box.bottom));y++)for(let x=Math.max(0,Math.floor(box.left));x<Math.min(width,Math.ceil(box.right));x++){
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a.y>y+.5)!==(b.y>y+.5)&&x+.5<(b.x-a.x)*(y+.5-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    if(!inside)continue;
    const offset=(y*width+x)*4,r=rgba[offset],g=rgba[offset+1],b=rgba[offset+2],sum=r+g+b;
    if(sum<75||sum>735)continue;
    [r,g,b].forEach((v,k)=>{hist[k*8+Math.min(7,Math.floor(v/sum*12))]++;});count++;
  }
  return count>=18?hist.map(v=>v/count):null;
}
const validVector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
export function identityDistance(profile,d){
  if(!validVector(d.boneShape,22)||!validVector(d.appearance,24))return null;
  const shape=profile.bones.reduce((sum,v,i)=>sum+Math.abs(Math.log(Math.max(.001,d.boneShape[i])/Math.max(.001,v))),0)/22;
  const color=profile.color.reduce((sum,v,i)=>sum+Math.abs(v-d.appearance[i]),0)/6;
  return {shape,color,score:shape*1.8+color};
}
export function rememberIdentity(t,d,now){
  if(!validVector(d.boneShape,22)||!validVector(d.appearance,24)||Math.abs(d.palmFacing??0)<.55)return;
  const key=d.palmFacing>0?'positive':'negative';
  t._identity??={};let profile=t._identity[key];
  if(!profile){t._identity[key]={bones:[...d.boneShape],color:[...d.appearance],samples:1,last:now};return;}
  if(now-profile.last<80)return;
  const metric=identityDistance(profile,d);
  // Avoid letting a mistaken association quickly rewrite a remembered identity.
  if(metric.shape>.18||metric.color>.24)return;
  const rate=1/Math.min(profile.samples+1,20);
  profile.bones=profile.bones.map((v,i)=>v+(d.boneShape[i]-v)*rate);
  profile.color=profile.color.map((v,i)=>v+(d.appearance[i]-v)*rate);
  profile.samples++;profile.last=now;
}
export function matchIdentity(t,d){
  const profile=t._identity?.[d.palmFacing>0?'positive':'negative'];
  if(!profile||profile.samples<4||Math.abs(d.palmFacing??0)<.45)return null;
  const metric=identityDistance(profile,d);
  return metric?{...metric,accepted:metric.shape<.16&&metric.color<.20&&metric.score<.36}:null;
}

// First stable hand face is the reference. Edge-on hands and brief normal flips hold it.
export function updateFacing(t,d,now){
  t.facing??=1;
  if(!Number.isFinite(d.palmFacing)||Math.abs(d.palmFacing)<.40){t._faceCandidate=null;return;}
  const sign=Math.sign(d.palmFacing);
  if(t._faceCandidate!==sign){t._faceCandidate=sign;t._faceSince=now;}
  if(now-t._faceSince<160)return;
  t._faceBase??=sign;
  t.facing=sign===t._faceBase?1:-1;
}
export function puppetTurn(p,actionTurn=1){
  const turn=actionTurn*(p.facing===-1?-1:1);
  return Math.sign(turn||1)*Math.max(.08,Math.abs(turn));
}
