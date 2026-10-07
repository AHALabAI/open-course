import {drawPuppet} from './puppet.mjs';
// Sample character pixels rather than control strings or a broad bounding rectangle.
const hitCanvas=typeof document==='undefined'?null:document.createElement('canvas');
export function hitPuppet(puppets,x,y,w,h){
 if(!hitCanvas||x<0||y<0||x>=w||y>=h)return null;
 if(hitCanvas.width!==w||hitCanvas.height!==h){hitCanvas.width=w;hitCanvas.height=h;}
 const g=hitCanvas.getContext('2d',{willReadFrequently:true});
 for(let i=puppets.length-1;i>=0;i--){const p=puppets[i];if(p.state==='dormant')continue;g.clearRect(0,0,w,h);drawPuppet(g,{...p,rig:'none',hideLabel:true,selected:false,state:'tracked'},w,h);
   const sx=Math.max(0,Math.floor(x)-8),sy=Math.max(0,Math.floor(y)-8),pixels=g.getImageData(sx,sy,Math.min(17,w-sx),Math.min(17,h-sy)).data;
   let visible=0;for(let k=3;k<pixels.length;k+=4)if(pixels[k]>48)visible++;
   if(visible>=2)return p;
 }
 return null;
}
export function drawSelection(ctx,p,w,h){
 const scale=Math.min(w/1100,h/650)*.94,x=90*scale+p.x*(w-180*scale),y=150*scale+p.y*(h-245*scale);
 ctx.save();ctx.strokeStyle='#8b3623';ctx.lineWidth=2;const rx=92*scale,top=Math.max(42,y-110*scale),bottom=Math.min(h-42,y+137*scale),n=11;
 for(const [sx,sy,dx,dy] of [[x-rx,top,1,1],[x+rx,top,-1,1],[x-rx,bottom,1,-1],[x+rx,bottom,-1,-1]]){ctx.beginPath();ctx.moveTo(sx,sy+dy*n);ctx.lineTo(sx,sy);ctx.lineTo(sx+dx*n,sy);ctx.stroke();}
 ctx.restore();
}
