export const ROOF_Y=3.75,EYE_HEIGHT=1.55;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]],key=p=>p.join(',');
const wall=(grid,p)=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&grid[p[1]]?.[p[0]]===1;
export function besideWall(grid,p){return DIRS.some(([dx,dz])=>wall(grid,[p[0]+dx,p[1]+dz]));}
function flood(grid,start){
  const cells=[start],previous=new Map([[key(start),null]]),distance=new Map([[key(start),0]]);
  for(let i=0;i<cells.length;i++)for(const [dx,dz] of DIRS){
    const p=[cells[i][0]+dx,cells[i][1]+dz];
    if(wall(grid,p)&&!previous.has(key(p))){previous.set(key(p),cells[i]);distance.set(key(p),distance.get(key(cells[i]))+1);cells.push(p);}
  }
  return {cells,previous,distance};
}
// Legacy "exit" coordinates now locate the ground-level ladder; roofExit is the door.
export function planRooftop(grid,ladder,door){
  if(!Array.isArray(ladder)||grid[ladder[1]]?.[ladder[0]]!==0)throw Error('梯子要放在道路格上');
  const landings=DIRS.map(([dx,dz])=>[ladder[0]+dx,ladder[1]+dz]).filter(p=>wall(grid,p));
  if(!landings.length)throw Error('梯子旁边需要一面墙，请把梯子放到靠墙的道路格');
  if(door!=null&&!wall(grid,door))throw Error('出口门要放在墙格上，爬上墙顶后才能到达');
  const choices=landings.map(landing=>({landing,...flood(grid,landing)}));
  let chosen;
  if(door!=null){
    chosen=choices.filter(c=>(c.distance.get(key(door))??0)>0).sort((a,b)=>a.distance.get(key(door))-b.distance.get(key(door)))[0];
    if(!chosen)throw Error('梯子与出口门之间没有墙顶路线，或门就在梯子顶端。请连接墙格，或移动梯子、门');
  }else{
    chosen=choices.filter(c=>c.cells.length>1).sort((a,b)=>b.cells.length-a.cells.length)[0];
    if(!chosen)throw Error('梯子上方只有一块孤立的墙，请连接更多墙格');
    door=chosen.cells.filter(p=>chosen.distance.get(key(p))<=8).at(-1);
  }
  const path=[];for(let p=door;p;p=chosen.previous.get(key(p)))path.push(p);
  const walkGrid=grid.map(row=>row.map(()=>1));for(const [x,z] of chosen.cells)walkGrid[z][x]=0;
  return {ladder:[...ladder],landing:chosen.landing,door:[...door],path:path.reverse(),walkGrid,direction:chosen.landing.map((n,i)=>n-ladder[i])};
}
