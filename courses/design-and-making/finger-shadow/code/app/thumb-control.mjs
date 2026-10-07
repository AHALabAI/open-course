const clamp=n=>Math.max(0,Math.min(1,n));
const vector=(a,b)=>[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)];
const length=v=>Math.hypot(...v);
const distance=(a,b)=>length(vector(a,b));
const angle=(a,b)=>{const divisor=length(a)*length(b);return divisor<1e-8?0:Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+v*b[i],0)/divisor)));};
export function measureThumb(p){
 const chain=distance(p[1],p[2])+distance(p[2],p[3])+distance(p[3],p[4]);
 if(chain<1e-8)return {thumb:.5,thumbExtension:.5,thumbSpread:.5};
 const straightness=distance(p[1],p[4])/chain;
 const bend=(angle(vector(p[1],p[2]),vector(p[3],p[2]))+angle(vector(p[2],p[3]),vector(p[4],p[3])))/2;
 // Anatomical angles and palm-relative opening respond to both flexion and sideways swing.
 const extension=.6*clamp((straightness-.72)/.26)+.4*clamp((bend-1.65)/1.35);
 const spread=clamp((angle(vector(p[4],p[1]),vector(p[9],p[0]))-.20)/1.05);
 return {thumb:clamp(extension*(.35+.65*spread)),thumbExtension:extension,thumbSpread:spread};
}
export function amplifyThumb(value,gain=1){return clamp(.5+(value-.5)*Math.max(1,Math.min(3,gain)));}
