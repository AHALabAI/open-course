// Procedural musical feedback: soft non-realistic cues for a children's game.
const defaults={music:true,effects:true,musicVolume:.25,effectsVolume:.6};
const KEY='paper-maze-sound-v1';
function bounded(value,fallback){return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;}
export function readPreferences(){
  try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');return {music:typeof p.music==='boolean'?p.music:true,effects:typeof p.effects==='boolean'?p.effects:true,musicVolume:bounded(p.musicVolume,.25),effectsVolume:bounded(p.effectsVolume,.6)};}catch{return {...defaults};}
}
function note(ctx,out,freq,time,duration,gain=.12,type='sine',to=null){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;
  o.frequency.setValueAtTime(freq,time);if(to)o.frequency.exponentialRampToValueAtTime(to,time+duration);
  g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(gain,time+.009);g.gain.exponentialRampToValueAtTime(.0001,time+duration);
  o.connect(g).connect(out);o.start(time);o.stop(time+duration+.015);o.onended=()=>{o.disconnect();g.disconnect();};
}
function noise(ctx,out,time,duration,volume,frequency){
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),channel=buffer.getChannelData(0);
  let seed=1943;for(let i=0;i<channel.length;i++){seed=(seed*16807)%2147483647;channel[i]=(seed/2147483647*2-1);}
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
  src.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;
  g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+.015);g.gain.exponentialRampToValueAtTime(.0001,time+duration);
  src.connect(filter).connect(g).connect(out);src.start(time);src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect();};
}
export function renderCue(ctx,out,name,time=ctx.currentTime){
  if(name==='collect'||name==='key'){
    (name==='key'?[659.25,987.77,1318.51]:[1046.5,1318.51,1567.98]).forEach((f,i)=>note(ctx,out,f,time+i*(name==='key'?.09:.055),.2,.075));
  }else if(name==='swing'){
    noise(ctx,out,time,.19,.16,1700);
    note(ctx,out,540,time,.15,.035,'sine',320);
  }else if(name==='hit'){
    note(ctx,out,430,time,.16,.22,'sine',160);
    note(ctx,out,783.99,time+.045,.12,.08);
    note(ctx,out,1046.5,time+.105,.16,.07);
    noise(ctx,out,time,.065,.075,1100);
  }else if(name==='defeat'){
    note(ctx,out,390,time,.16,.18,'sine',175);
    [0,.045,.095,.165,.24].forEach((t,i)=>{noise(ctx,out,time+t,.07,.1-i*.012,650+i*200);note(ctx,out,720-i*72,time+t,.06,.035,'triangle');});
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>note(ctx,out,f,time+.055+i*.09,.27,.10));
    note(ctx,out,1567.98,time+.40,.27,.035);
  }else if(name==='ignite'){
    noise(ctx,out,time,.23,.09,900);[523.25,783.99,1046.5].forEach((f,i)=>note(ctx,out,f,time+i*.085,.22,.065));
  }else if(name==='win'){
    [523.25,659.25,783.99,1046.5,1318.51].forEach((f,i)=>note(ctx,out,f,time+i*.10,.35,.10));
    [261.63,329.63,392].forEach(f=>note(ctx,out,f,time+.3,.62,.035));
  }
}
export function createGameAudio(onChange=()=>{}){
  let prefs=readPreferences(),ctx,bus,active=false,duckUntil=0,duckTimer=null,lastCue=null,cueCount=0,error='',destroyed=false;
  const music=new Audio();music.loop=true;music.preload='none';
  music.src=new URL('../assets/music/turn-a-corner-playful.ogg',import.meta.url).href;
  function notify(){onChange({...prefs,error});}
  function volume(){music.volume=prefs.musicVolume*(performance.now()<duckUntil?.5:1);}
  function context(){
    if(destroyed)return null;
    try{
      if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();bus=ctx.createGain();bus.gain.value=prefs.effectsVolume;bus.connect(ctx.destination);}
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      return ctx;
    }catch{return null;}
  }
  function sync(){
    volume();
    if(active&&prefs.music&&!document.hidden&&!destroyed){
      if(music.paused)music.play().then(()=>{if(!active||!prefs.music||document.hidden)music.pause();else if(error){error='';notify();}}).catch(()=>{error='音乐暂未播放，可关闭后再打开重试。';notify();});
    }else music.pause();
    if(bus)bus.gain.setTargetAtTime(prefs.effects?prefs.effectsVolume:0,ctx.currentTime,.015);
  }
  music.addEventListener('error',()=>{error='音乐文件暂时无法播放，游戏可以继续。';notify();});
  function duck(seconds=.42){
    duckUntil=performance.now()+seconds*1000;volume();clearTimeout(duckTimer);duckTimer=setTimeout(volume,seconds*1000+20);
  }
  const api={
    setActive(value){active=!!value;if(active&&prefs.effects)context();sync();},
    settings(){return {...prefs,error};},
    set(patch){
      prefs={music:typeof patch.music==='boolean'?patch.music:prefs.music,effects:typeof patch.effects==='boolean'?patch.effects:prefs.effects,musicVolume:bounded(patch.musicVolume,prefs.musicVolume),effectsVolume:bounded(patch.effectsVolume,prefs.effectsVolume)};
      try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}
      if(prefs.effects&&active)context();sync();notify();
    },
    cue(name){
      if(!prefs.effects||!prefs.effectsVolume||destroyed)return;
      const c=context();if(!c)return;
      renderCue(c,bus,name);lastCue=name;cueCount++;duck(name==='win'?.95:.45);
    },
    tone(freq=600){
      if(!prefs.effects||!prefs.effectsVolume||destroyed)return;
      const c=context();if(c)note(c,bus,freq,c.currentTime,.23,.075,'sine',freq*1.45);
    },
    inspect(){return {...prefs,active,paused:music.paused,currentTime:music.currentTime,duration:music.duration,volume:music.volume,context:ctx?.state||'uninitialized',lastCue,cueCount,error};},
    destroy(){destroyed=true;active=false;music.pause();clearTimeout(duckTimer);ctx?.close().catch(()=>{});}
  };
  return api;
}
