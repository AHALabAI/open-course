// Procedural cues: no recordings or externally licensed music files required.
export function createGameAudio(){
 let context,muted=false,last=0;
 const button=document.createElement('button');button.textContent='声音：开';
 button.setAttribute('aria-pressed','true');document.querySelector('.topright').append(button);
 button.onclick=()=>{muted=!muted;button.textContent=muted?'声音：关':'声音：开';button.setAttribute('aria-pressed',String(!muted));};
 const unlock=()=>{try{context??=new(window.AudioContext||window.webkitAudioContext)();void context.resume().catch(()=>{});}catch{}};
 document.addEventListener('pointerdown',unlock,{passive:true});
 function play(name){
  if(muted||!context||context.state!=='running'||performance.now()-last<90)return;
  last=performance.now();
  const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
  oscillator.type='sine';oscillator.frequency.value=name.includes('fail')||name.includes('hurt')?170:name.includes('unlock')?660:name.includes('complete')?880:420;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.045,now+.01);gain.gain.exponentialRampToValueAtTime(.001,now+.18);
  oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(now+.2);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }
 return {play,update(){},diagnostics:()=>({muted,context:context?.state,source:'Web Audio synthesis',errors:[]})};
}
