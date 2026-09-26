import {reachable,findPath,cellKey,neighbors} from './levels.mjs';
// Fixed positions make replays learnable. The first fire is close and always reachable.
export function planNight(level){
  if(level.index<4)return {enabled:false,source:null,torches:[]};
  const {grid,start,exit}=level,{cells,distances}=reachable(grid,start);
  const occupied=new Set([start,exit,...level.items.map(i=>i.cell),...level.enemies.map(e=>e.cell)].map(cellKey));
  const nearWall=([x,z])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>grid[z+b]?.[x+a]===1);
  const candidates=cells.filter(p=>!occupied.has(cellKey(p))&&nearWall(p));
  const source=candidates.filter(p=>distances.get(cellKey(p))>=3&&distances.get(cellKey(p))<=5).sort((a,b)=>Math.abs(distances.get(cellKey(a))-4)-Math.abs(distances.get(cellKey(b))-4))[0]||candidates[0];
  if(!source)throw Error('黑暗关没有可达的火源位置');
  const count=level.index,torches=[],main=findPath(grid,start,exit);
  const remaining=candidates.filter(p=>cellKey(p)!==cellKey(source)&&distances.get(cellKey(p))>5);
  // Establish a chain on the principal route, then add beacons near side branches.
  for(let i=1;i<=Math.ceil(count*.65);i++){
    const target=main[Math.floor(i*(main.length-1)/(Math.ceil(count*.65)+1))];
    const p=remaining.filter(p=>!torches.some(t=>cellKey(t)===cellKey(p))).sort((a,b)=>(Math.abs(a[0]-target[0])+Math.abs(a[1]-target[1]))-(Math.abs(b[0]-target[0])+Math.abs(b[1]-target[1])))[0];
    if(p)torches.push(p);
  }
  while(torches.length<count){
    const pool=remaining.filter(p=>!torches.some(t=>cellKey(t)===cellKey(p)));
    if(!pool.length)break;
    const score=p=>Math.min(...[source,...torches].map(q=>Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])))+(neighbors(grid,p).length>2?1:0);
    pool.sort((a,b)=>score(b)-score(a));torches.push(pool[0]);
  }
  return {enabled:true,source:[...source],torches:torches.map(p=>[...p])};
}
export function lineClear(grid,a,b){
  const length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(length/.15));
  for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps;if(grid[Math.floor(z/3+.5)]?.[Math.floor(x/3+.5)]!==0)return false;}
  return true;
}
