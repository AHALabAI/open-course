const clamp=v=>Math.max(0,Math.min(1,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
function angle(a,b,c){const u=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)],v=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)],length=Math.hypot(...u)*Math.hypot(...v);return length>1e-9?Math.acos(Math.max(-1,Math.min(1,u.reduce((s,n,i)=>s+n*v[i],0)/length))):null;}
// Object grasp uses both finger joints plus shortening of the finger chain.
// It deliberately does not reuse the puppet's one-joint articulation value.
export function graspExtensions(points){
 return [5,9,13,17].map(i=>{
  const chain=[points[i],points[i+1],points[i+2],points[i+3]];
  if(chain.some(p=>!p||![p.x,p.y,p.z||0].every(Number.isFinite)))return null;
  const length=distance(chain[0],chain[1])+distance(chain[1],chain[2])+distance(chain[2],chain[3]);
  if(length<1e-5)return null;
  const pip=angle(...chain.slice(0,3)),dip=angle(...chain.slice(1));if(pip==null||dip==null)return null;
  const joint=clamp(((pip+dip)/2-1.35)/1.35),reach=clamp((distance(chain[0],chain[3])/length-.42)/.48);
  return Math.min(joint,reach);
 });
}
export function graspFeatures(world,image,palmFacing){
 const extension=graspExtensions(world);
 // On the back of a fist, hidden tips can acquire unreliable depth. Three tips
 // projected inside the palm are independent evidence of a closed hand.
 // Do not use this cue edge-on, where a straight finger is foreshortened.
 if(!Number.isFinite(palmFacing)||Math.abs(palmFacing)<.5)return extension;
 const projected=[5,9,13,17].map(i=>{const wrist=image[0],base=image[i],tip=image[i+3],dx=base.x-wrist.x,dy=base.y-wrist.y,length=dx*dx+dy*dy;if(length<1e-6)return null;const along=((tip.x-wrist.x)*dx+(tip.y-wrist.y)*dy)/length,lateral=Math.abs((tip.x-wrist.x)*dy-(tip.y-wrist.y)*dx)/length;return lateral<.75&&along>.1&&along<1.15?clamp((along-.85)/.75):null;});
 if(projected.filter(Number.isFinite).length<3)return extension;
 return extension.map((value,i)=>projected[i]==null?value:Math.min(value??1,projected[i]));
}
