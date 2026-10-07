import {STATIC_HOST} from './runtime-config.mjs';
const $=id=>document.getElementById(id);
export class DramaTTS{
 constructor({mount,script,line,canPlay,quiet,status}){
  Object.assign(this,{script,line,canPlay,quiet,status});this.serial=0;this.cache=new Map();this.player=null;this.generated=null;this.abort=null;
  mount.innerHTML=`<details class="drama-tts"><summary>朗读音频 · 试听与下载</summary><div class="drama-tts-controls"><label>英语声音<select id="drama-tts-voice"><option value="Microsoft Zira Desktop">课前示范 · Zira 美式英语</option></select></label><label>语速<select id="drama-tts-rate"><option value="preset">课前示范速度</option><option value="-2">慢一些</option><option value="0">正常</option><option value="-4">再慢一些</option></select></label></div><div class="drama-buttons"><button id="drama-tts-line">准备这一句</button><button id="drama-tts-play">准备整出戏</button><button id="drama-tts-download" disabled>下载 WAV 音频</button><button id="drama-tts-stop">停止朗读</button></div><p id="drama-tts-status" class="drama-note">六出戏已备好逐句和整剧朗读。默认直接播放已有音频；需要换声音或语速时，可在本机版本重新生成。</p><a id="drama-tts-preset" hidden download>下载这出戏的预备朗读 ↗</a></details>`;
  $('drama-tts-line').onclick=()=>this.generate(false,false);$('drama-tts-play').onclick=()=>this.generate(true,false);$('drama-tts-download').onclick=()=>this.download();$('drama-tts-stop').onclick=()=>{this.cancel();this.message('朗读已停止。');};$('drama-tts-voice').onchange=$('drama-tts-rate').onchange=()=>this.cancel();
  this.ready=this.load();
 }
 message(text){$('drama-tts-status').textContent=text;}
 async load(){
  try{const response=await fetch('../assets/english/manifest.json');if(response.ok)this.presets=(await response.json()).plays;}catch{}
  this.updatePreset();
  // Installed voice discovery must not delay pre-generated classroom audio.
  if(STATIC_HOST)return;this.voicesReady=fetch('/api/tts/voices',{signal:AbortSignal.timeout(6000)}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);const select=$('drama-tts-voice');for(const voice of data.voices||[])if(![...select.options].some(o=>o.value===voice.name))select.add(new Option(voice.name+' · '+voice.language,voice.name));}).catch(()=>{});
 }
 updatePreset(){const play=this.script(),preset=this.presets?.find(p=>p.id===play?.id),link=$('drama-tts-preset');link.hidden=!preset;if(preset){link.href='../assets/english/'+preset.file;link.download=preset.file;link.textContent='下载《'+play.title+'》预备朗读 ↗';}}
 async generate(whole=false,autoplay=false){
  if(!this.canPlay()){this.status('先结束或取消录音，再听示范。');return;}this.cancel();const serial=this.serial,play=this.script(),index=this.line();if(!play)return;await this.ready;if(serial!==this.serial)return;
  const preset=this.presets?.find(p=>p.id===play.id),voice=$('drama-tts-voice').value,rateValue=$('drama-tts-rate').value,rate=rateValue==='preset'?(preset?.rate??-2):Number(rateValue),text=whole?play.lines.map(row=>row[1]).join(' '):play.lines[index][1];if(!voice){this.message('请先准备本机英语声音。');return;}
  const candidate=whole?preset:preset?.lines?.find(l=>l.index===index),prepared=candidate?.text===text&&candidate.voice===voice&&candidate.rate===rate?candidate:null,key=JSON.stringify([text,voice,rate]);this.message(prepared?'正在读取课前准备好的朗读…':'正在生成'+(whole?'整出戏':'这一句')+'的英语朗读…');this.status(prepared?'正在准备示范音频…':'正在生成本机朗读音频…');
  try{let url=this.cache.get(key);if(!url){this.abort=new AbortController();let bytes;
   if(prepared){const response=await fetch('../assets/english/'+prepared.file,{signal:this.abort.signal});if(!response.ok)throw Error('预备音频暂时读不到，请刷新后重试。');bytes=new Uint8Array(await response.arrayBuffer());}
   else{if(STATIC_HOST)throw Error('网页请选课前示范速度；改词或换声音后可在本机重新生成。');const response=await fetch('/api/tts/synthesize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice,rate}),signal:this.abort.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'朗读没有生成。');bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));}
   if(serial!==this.serial)return;if(bytes.length<44||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WAVE')throw Error('朗读文件不完整，请重新准备。');url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));this.cache.set(key,url);if(this.cache.size>24){const oldest=this.cache.keys().next().value;URL.revokeObjectURL(this.cache.get(oldest));this.cache.delete(oldest);}}
   if(serial!==this.serial)return;this.generated={url,name:play.id+(whole?'-full':'-line-'+(index+1))+'.wav'};$('drama-tts-download').disabled=false;this.message((whole?'整出戏':'本句')+'朗读已备好，可下载 WAV。'+voice+'，'+(rate===0?'正常语速':'慢速')+'。');this.status(autoplay?(prepared?'正在听课前准备好的英语朗读。':'正在听本机生成的英语朗读。'):'朗读音频已备好，可在“朗读音频”里下载。');if(autoplay){this.quiet();this.player=new Audio(url);await this.player.play();}
  }catch(error){if(serial!==this.serial)return;this.message(error.name==='AbortError'?'本次生成已取消。':error.message);this.status('朗读未完成，可再试一次或请老师领读。');}
 }
 listen(){return this.generate(false,true);}
 download(){if(!this.generated)return;const a=document.createElement('a');a.href=this.generated.url;a.download=this.generated.name;a.click();}
 cancel(){this.serial++;this.abort?.abort();this.abort=null;this.player?.pause();if(this.player)this.player.src='';this.player=null;this.generated=null;if($('drama-tts-download'))$('drama-tts-download').disabled=true;}
 close(){this.cancel();for(const url of this.cache.values())URL.revokeObjectURL(url);this.cache.clear();}
}
