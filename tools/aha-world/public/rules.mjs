// 课堂先只改一个数，再让同伴试玩同一个任务。
export const CHARACTER_SCALE = 0.65;
export const RULES = {
  duration: 180,       // 一轮秒数
  nightAt: 100,        // 入夜时刻
  speed: 4.8,
  hungerDrain: 0.22,
  thirstDrain: 0.30,
  coldDamage: 1.1,
  beaconCost: { wood: 3, stone: 2, crystal: 3 },
  fireCost: { wood: 2, stone: 1 },
  aiInterval: 8,       // 两次决策最少间隔秒数
  confidenceThreshold: 0.60
};
export const FLOOR_NAMES = ['集合 · 庭院与大厅', '探索 · 阅读与观察', '创造 · 制作与实验', '远望 · 观测与露台'];
export function newGame(overrides={}) {
  return { elapsed:0, health:100, hunger:100, thirst:100, inventory:{wood:0,stone:0,crystal:0,food:1},
    fire:false, beacon:false, status:'playing', ...overrides };
}
export function canPay(inventory,cost) { return Object.entries(cost).every(([k,v])=>(inventory[k]||0)>=v); }
export function pay(inventory,cost) {
  if(!canPay(inventory,cost)) return false;
  for(const [k,v] of Object.entries(cost)) inventory[k]-=v;
  return true;
}
export function tickState(state,dt,sheltered,rules=RULES) {
  if(state.status!=='playing') return state;
  state.elapsed+=dt;
  state.hunger=Math.max(0,state.hunger-dt*rules.hungerDrain);
  state.thirst=Math.max(0,state.thirst-dt*rules.thirstDrain);
  const cold=state.elapsed>=rules.nightAt&&!sheltered;
  state.health=Math.max(0,state.health-dt*((state.hunger===0?2:0)+(state.thirst===0?3:0)+(cold?rules.coldDamage:0)));
  if(state.health<=0) state.status='lost';
  else if(state.elapsed>=rules.duration) state.status=state.beacon?'won':'lost';
  return state;
}
export function blocked(x,z,floor,colliders,blocks=[]) {
  if(floor===0 ? (Math.abs(x)>18||Math.abs(z)>16) : (Math.abs(x)>7.1||z>5.1||z<(floor===3?-11:-5.1))) return true;
  return [...colliders,...blocks].some(c=>(c.floor===floor||(floor===0&&c.floor===-1))&&Math.abs(x-c.x)<c.w/2+.27&&Math.abs(z-c.z)<c.d/2+.27);
}
export function localDecision(s) {
  const choice = s.health<40?'assist':s.night?'shelter':s.wood<5?'gather':'guard';
  return {choice,confidence:null,probabilities:null,urgency:s.health<40?2:s.night?1:0,danger:s.night?1:0,source:'local',reason:'本地规则'};
}
export function parseDecision(data,threshold=RULES.confidenceThreshold) {
  const a=data?.answers, c=a?.action, u=a?.urgency, d=a?.danger;
  if(!['gather','assist','shelter','guard'].includes(c?.choice)) throw Error('invalid_choice');
  if(!Number.isFinite(c.confidence)||c.confidence<0||c.confidence>1) throw Error('invalid_confidence');
  if(!Number.isFinite(u?.score)||u.score<0||u.score>2) throw Error('invalid_score');
  if(!Number.isFinite(d?.noul)||d.noul<0||d.noul>1) throw Error('invalid_noul');
  const probabilities=c.probabilities;
  if(!probabilities||!['gather','assist','shelter','guard'].every(k=>Number.isFinite(probabilities[k])&&probabilities[k]>=0&&probabilities[k]<=1)) throw Error('invalid_probabilities');
  return {choice:c.confidence>=threshold?c.choice:'guard',proposed:c.choice,confidence:c.confidence,probabilities,
    urgency:u.score,danger:d.noul,source:'jev',reason:c.confidence>=threshold?'模型决策':'低置信度 → 守候'};
}
