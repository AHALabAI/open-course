import {planRooftop} from './rooftop.mjs';
import {validTheme} from './themes.mjs';
// 地图坐标为 [列, 行]。1 是墙，0 是路。第一关人工描摹，其余固定种子生成。
export const LEVELS = [
  {name:'纸上的第一步',tag:'手绘原点',size:0,gems:3,keys:0,npcs:0,defeat:0,theme:0,brief:'找到 3 颗光晶，找到梯子爬上墙，再走到出口门。没有怪物，慢慢探索。'},
  {name:'岔路的礼物',tag:'学会选择',size:9,gems:4,keys:0,npcs:0,defeat:0,theme:1,brief:'岔路里藏着 4 颗光晶。走过的路，可以放一块路标。'},
  {name:'钥匙在哪里',tag:'先后顺序',size:11,gems:4,keys:1,npcs:0,defeat:0,theme:2,brief:'收集 4 颗光晶和 1 把金钥匙，出口才会打开。'},
  {name:'苔藓巡逻员',tag:'观察与等待',size:13,gems:5,keys:1,npcs:1,defeat:0,theme:0,brief:'收齐光晶和钥匙，观察巡逻怪物。可以等它走开，也能用光杖击退。'},
  {name:'两位守路人',tag:'黑暗与火种',size:15,gems:5,keys:1,npcs:2,defeat:0,theme:1,brief:'先找小火堆，按 E 取火种，再逐一点亮火把。避开两只怪物，收齐物品到出口。'},
  {name:'光杖练习场',tag:'第一次击退',size:17,gems:5,keys:1,npcs:2,defeat:1,theme:2,brief:'用光杖击退至少 1 只怪物，再收齐物品到出口。对准近处怪物，按空格。'},
  {name:'双钥匙回廊',tag:'记忆与回访',size:19,gems:6,keys:2,npcs:2,defeat:1,theme:0,brief:'两把钥匙分散在回廊里。收齐物品，并击退至少 1 只怪物。'},
  {name:'水晶守护者',tag:'组合条件',size:21,gems:6,keys:2,npcs:3,defeat:2,theme:2,brief:'收齐 6 颗光晶、2 把钥匙，击退至少 2 只怪物。路标会帮你。'},
  {name:'雾中的远征',tag:'更远的探索',size:23,gems:7,keys:2,npcs:4,defeat:3,theme:1,brief:'在更多岔路中收齐物品，击退至少 3 只怪物。没有时间限制。'},
  {name:'小小迷宫大师',tag:'综合挑战',size:25,gems:8,keys:3,npcs:5,defeat:5,theme:0,brief:'最后的挑战：8 颗光晶、3 把钥匙、5 只守路怪。准备好就出发！'},
];
export const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
export const cellKey=([x,z])=>`${x},${z}`;
export const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export function neighbors(grid,[x,z]) {return DIRS.map(([dx,dz])=>[x+dx,z+dz]).filter(([a,b])=>grid[b]?.[a]===0);}
export function reachable(grid,start){const queue=[start], distances=new Map([[cellKey(start),0]]);for(let i=0;i<queue.length;i++)for(const p of neighbors(grid,queue[i]))if(!distances.has(cellKey(p))){distances.set(cellKey(p),distances.get(cellKey(queue[i]))+1);queue.push(p);}return {cells:queue,distances};}
export function findPath(grid,start,end){const queue=[start], prev=new Map([[cellKey(start),null]]);for(let i=0;i<queue.length;i++){const p=queue[i];if(same(p,end)){const out=[];let q=p;while(q){out.push(q);q=prev.get(cellKey(q));}return out.reverse();}for(const q of neighbors(grid,p))if(!prev.has(cellKey(q))){prev.set(cellKey(q),p);queue.push(q);}}return [];}
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export const HAND_PATHS = [
  // 中部入口 → 小回折 → 大回折 → 右侧长回廊。
  [[11,13],[11,15],[15,15],[15,19],[11,19],[11,25],[15,25],[15,27],[7,27],[7,31],[21,31]],
  // 上部蛇形盲端，鼓励探索后返回。原图上端交叠按连续道路解释。
  [[21,31],[21,9],[13,9],[13,7],[21,7],[21,1],[11,1],[11,3],[19,3],[19,5],[11,5]],
  // 中部左侧的小回路。
  [[11,15],[5,15],[5,21],[11,21]],
  // 左侧长盲端与下部出路。
  [[17,31],[17,35],[3,35],[3,13]],
  [[19,31],[19,37],[5,37],[5,41]],
];
export function handLevel(){const grid=Array.from({length:43},()=>Array(25).fill(1));for(const points of HAND_PATHS)for(let i=1;i<points.length;i++){let [x,z]=points[i-1];const [tx,tz]=points[i];grid[z][x]=0;while(x!==tx||z!==tz){x+=Math.sign(tx-x);z+=Math.sign(tz-z);grid[z][x]=0;}}return {...LEVELS[0],grid,start:[11,13],exit:[5,41],items:[{type:'gem',cell:[11,14]},{type:'gem',cell:[11,23]},{type:'gem',cell:[9,27]}],enemies:[],index:0};}
export function generateLevel(index){if(index===0)return handLevel();const cfg=LEVELS[index];if(!cfg)throw Error('关卡不存在');const random=rng(92501+index*1387),n=cfg.size,grid=Array.from({length:n},()=>Array(n).fill(1)),stack=[[1,1]];grid[1][1]=0;
  while(stack.length){const [x,z]=stack.at(-1),opts=DIRS.map(([dx,dz])=>[x+dx*2,z+dz*2,dx,dz]).filter(([a,b])=>a>0&&b>0&&a<n-1&&b<n-1&&grid[b][a]);if(!opts.length){stack.pop();continue;}const [a,b,dx,dz]=opts[Math.floor(random()*opts.length)];grid[z+dz][x+dx]=0;grid[b][a]=0;stack.push([a,b]);}
  // 后期少量连通环，允许绕行。
  if(index>=4)for(let j=0;j<index-2;j++){const x=1+Math.floor(random()*(n-2)),z=1+Math.floor(random()*(n-2));if(grid[z][x]===1&&((grid[z][x-1]===0&&grid[z][x+1]===0)||(grid[z-1][x]===0&&grid[z+1][x]===0)))grid[z][x]=0;}
  const start=[1,1],{cells,distances}=reachable(grid,start),ordered=cells.toSorted((a,b)=>distances.get(cellKey(b))-distances.get(cellKey(a))),exit=ordered[0],used=new Set([cellKey(start),cellKey(exit)]),items=[];
  const ends=ordered.filter(p=>neighbors(grid,p).length===1),pool=[...ends,...ordered.filter(p=>neighbors(grid,p).length!==1)];
  for(let j=0;j<cfg.gems+cfg.keys;j++){const p=pool.find(p=>!used.has(cellKey(p))&&distances.get(cellKey(p))>2);used.add(cellKey(p));items.push({type:j<cfg.gems?'gem':'key',cell:p});}
  const enemies=[];for(let j=0;j<cfg.npcs;j++){const p=ordered.filter(p=>!used.has(cellKey(p))&&distances.get(cellKey(p))>6)[Math.floor(random()*Math.max(1,ordered.filter(p=>!used.has(cellKey(p))&&distances.get(cellKey(p))>6).length))];used.add(cellKey(p));enemies.push({cell:p});}
  return {...cfg,index,grid,start,exit,items,enemies};
}
export function validateCustom(data){if(!data||!Array.isArray(data.grid)||data.grid.length<5||data.grid.length>43)throw Error('地图高度应为 5–43 格');const w=data.grid[0]?.length;if(w<5||w>43||data.grid.some(r=>!Array.isArray(r)||r.length!==w||r.some(v=>v!==0&&v!==1)))throw Error('地图必须为 5–43 格的矩形，格子只能是 0 或 1');
  if(data.grid.some((r,z)=>r.some((v,x)=>(z===0||x===0||z===data.grid.length-1||x===w-1)&&v!==1)))throw Error('地图四周需要封闭的墙');
  const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&data.grid[p[1]]?.[p[0]]===0;
  if(!valid(data.start)||!valid(data.exit)||same(data.start,data.exit))throw Error('起点与梯子要放在不同的道路格上');
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>16||data.items.some(i=>i.type!=='gem'||!valid(i.cell)))throw Error('请放 1–16 颗光晶，每颗都放在道路上');
  const positions=[data.start,data.exit,...data.items.map(i=>i.cell)];if(new Set(positions.map(cellKey)).size!==positions.length)throw Error('起点、梯子和光晶不能重叠');const r=reachable(data.grid,data.start);if(positions.some(p=>!r.distances.has(cellKey(p))))throw Error('还有到不了的光晶或梯子，请打通道路');
  const roof=planRooftop(data.grid,data.exit,data.roofExit);
  return {roofExit:roof.door,name:String(data.name||'我的纸上秘境').slice(0,24),tag:'我设计的关卡',index:-1,grid:data.grid,start:data.start,exit:data.exit,items:data.items,enemies:[],gems:data.items.length,keys:0,npcs:0,defeat:0,theme:validTheme(data.theme)?data.theme:0,brief:`这是你设计的迷宫！收集 ${data.items.length} 颗光晶，再找到梯子爬上墙，走到出口门。`};
}
