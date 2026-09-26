import {planRooftop,besideWall} from './rooftop.mjs';
export const MIN_SIZE=5,MAX_SIZE=43;
export const SIZE_PRESETS=[['7x7','7 × 7 · 迷你'],['11x11','11 × 11 · 入门'],['15x15','15 × 15 · 进阶'],['21x21','21 × 21 · 大地图'],['21x11','21 × 11 · 横向长方形'],['11x21','11 × 21 · 纵向长方形'],['25x43','25 × 43 · 手稿比例']];
export function checkSize(width,height){if(![width,height].every(n=>Number.isInteger(n)&&n>=MIN_SIZE&&n<=MAX_SIZE))throw Error(`宽和高都要是 ${MIN_SIZE}–${MAX_SIZE} 之间的整数。`);}
function emptyGrid(width,height){checkSize(width,height);return Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>x===0||z===0||x===width-1||z===height-1?1:0));}
export function blankDraft(width,height,source={}){const draft={name:source.name||'我的秘密花园',theme:source.theme??0,grid:emptyGrid(width,height),start:[1,1],exit:[width-2,height-2],items:[{type:'gem',cell:[Math.floor(width/2),Math.floor(height/2)]}]};draft.roofExit=planRooftop(draft.grid,draft.exit).door;return draft;}
export function resizeDraft(source,width,height){
  const grid=emptyGrid(width,height),oldHeight=source.grid.length,oldWidth=source.grid[0].length;
  // Keep the original top-left interior. Old perimeter walls become new open space.
  for(let z=1;z<Math.min(height-1,oldHeight-1);z++)for(let x=1;x<Math.min(width-1,oldWidth-1);x++)grid[z][x]=source.grid[z][x];
  const goals=[source.start,source.exit,...source.items.map(i=>i.cell)],used=new Set(),key=p=>p.join(','),inside=([x,z])=>x>0&&z>0&&x<width-1&&z<height-1&&grid[z][x]===0;
  const placed=goals.map((p,i)=>{if(!inside(p)||used.has(key(p))||(i===1&&!besideWall(grid,p)))return null;used.add(key(p));return [...p];});
  let moved=0;
  for(let i=0;i<placed.length;i++)if(!placed[i]){
    const [ox,oz]=goals[i],candidates=[];
    for(let z=1;z<height-1;z++)for(let x=1;x<width-1;x++)if(grid[z][x]===0&&!used.has(key([x,z]))&&(i!==1||besideWall(grid,[x,z])))candidates.push([x,z]);
    candidates.sort((a,b)=>(Math.abs(a[0]-ox)+Math.abs(a[1]-oz))-(Math.abs(b[0]-ox)+Math.abs(b[1]-oz)));
    if(!candidates.length)throw Error('这个尺寸没有足够的道路安放起点、出口和光晶。请选择大一点的尺寸，或先减少光晶、打通道路。');
    placed[i]=candidates[0];used.add(key(placed[i]));moved++;
  }
  let roof;try{roof=planRooftop(grid,placed[1],source.roofExit);}catch{roof=planRooftop(grid,placed[1]);}
  if(source.roofExit&&key(roof.door)!==key(source.roofExit))moved++;
  return {draft:{...source,grid,start:placed[0],exit:placed[1],roofExit:roof.door,items:source.items.map((item,i)=>({...item,cell:placed[i+2]}))},moved};
}
