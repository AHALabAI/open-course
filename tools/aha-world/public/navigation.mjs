export const FLOOR_HEIGHT=2.92;
import {outdoorFloor,outdoorBlocked} from './outdoor-layout.mjs';
import {CHARACTER_SCALE} from './rules.mjs';
const FOOT_RADIUS=.17*CHARACTER_SCALE,WALL_RADIUS=.20*CHARACTER_SCALE,BLOCK_RADIUS=.25*CHARACTER_SCALE;
export const LANDINGS=[{x:3.8,z:-.6},{x:3.6,z:-1},{x:3.6,z:-1},{x:3.6,z:-1}];
export const EXTERIOR_STAIRS={};
export const BEACON={x:-6,z:0,floor:3};
export const WATER={x:12,z:2.8,floor:0};
let source=null,doors=[];
export function setNavigation(data){source=data;doors=data.objects.filter(o=>o.type==='dw/door');}
export function inTriangle(x,z,t){
 const sign=(a,b)=>(x-b[0])*(a[1]-b[1])-(a[0]-b[0])*(z-b[1]);
 const d=t.map((a,i)=>sign(a,t[(i+1)%3]));
 return !(d.some(n=>n<-.00001)&&d.some(n=>n>.00001));
}
function doorway(x,z,f,inset=0){return doors.some(d=>{if(d.floor!==f)return false;const [x0,z0,x1,z1]=d.bounds;return x1-x0>z1-z0?x>=x0+inset&&x<=x1-inset&&z>=z0-.35&&z<=z1+.35:z>=z0+inset&&z<=z1-inset&&x>=x0-.35&&x<=x1+.35;});}
export function onFloor(x,z,f){return (f===0&&outdoorFloor(x,z))||!!source?.floors[f]?.walkable.some(t=>inTriangle(x,z,t))||doorway(x,z,f);}
export function sourceBlocked(x,z,f,blocks=[]){
 if(!source)return true;
 const floor=source.floors[f];if(!floor)return true;
 if(f===0&&outdoorBlocked(x,z))return true;
 if(![[0,0],[FOOT_RADIUS,0],[-FOOT_RADIUS,0],[0,FOOT_RADIUS],[0,-FOOT_RADIUS]].every(([dx,dz])=>onFloor(x+dx,z+dz,f)))return true;
 if(!doorway(x,z,f,WALL_RADIUS)&&floor.walls.some(([x0,z0,x1,z1])=>x>x0-WALL_RADIUS&&x<x1+WALL_RADIUS&&z>z0-WALL_RADIUS&&z<z1+WALL_RADIUS))return true;
 return blocks.some(b=>b.floor===f&&Math.abs(x-b.x)<b.w/2+BLOCK_RADIUS&&Math.abs(z-b.z)<b.d/2+BLOCK_RADIUS);
}
export function nearestWalkable(x,z,f){
 if(!sourceBlocked(x,z,f))return {x,z};
 for(let r=.2;r<=5;r+=.2)for(let i=0;i<32;i++){const a=i*Math.PI/16,p={x:x+Math.cos(a)*r,z:z+Math.sin(a)*r};if(!sourceBlocked(p.x,p.z,f))return p;}
 throw Error(`No walkable landing on floor ${f+1}`);
}
