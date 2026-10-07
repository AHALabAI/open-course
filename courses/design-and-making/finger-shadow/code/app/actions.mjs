// Deliberate, hold-to-confirm gestures; each hand has its own cooldown and rearm state.
export class ActionController{
  constructor(){this.states=new Map();}
  reset(){this.states.clear();}
  trigger(id,name,now){let s=this.states.get(id)||{};if(s.action||now<(s.cooldown||0))return false;s.action={name,start:now,duration:name==='turn'?1000:900};s.cooldown=now+1500;this.states.set(id,s);return true;}
  update(hand,now,enabled){
    const id=hand.id??'pointer',s=this.states.get(id)||{};this.states.set(id,s);
    if(s.action&&now-s.action.start>=s.action.duration)s.action=null;
    if(!enabled||hand.state!=='tracked'){s.candidate=null;s.since=now;s.armed=false;s.fistAt=null;return s.action?{...s.action,progress:(now-s.action.start)/s.action.duration}:null;}
    const f=hand.fingers||[],thumb=hand.thumbExtension??hand.thumb??.5;
    const open=f.length===4&&f.every(v=>v>.72),fist=f.length===4&&f.every(v=>v<.24);
    let gesture=f[0]>.78&&f[1]>.78&&f[2]<.28&&f[3]<.28?'jump':fist&&thumb>.83?'turn':fist&&thumb<.65?'fist':null;
    if(open){if(s.fistAt&&now-s.fistAt<1800&&s.armed){if(this.trigger(id,'prop',now))s.armed=false;s.fistAt=null;}else if(!s.action){s.armed=true;}}
    if(gesture!==s.candidate){s.candidate=gesture;s.since=now;}
    if(gesture&&now-s.since>=450&&s.armed){if(gesture==='fist'){s.fistAt=now;}else if(this.trigger(id,gesture,now)){s.armed=false;s.fistAt=null;}}
    return s.action?{...s.action,progress:Math.min(1,(now-s.action.start)/s.action.duration)}:null;
  }
}
export function actionPose(action){
  const t=action?.progress??0,a=Math.sin(Math.PI*t);
  return {lift:action?.name==='jump'?-72*a:0,turn:action?.name==='turn'?Math.cos(Math.PI*2*t):1,prop:action?.name==='prop'?a:0};
}
