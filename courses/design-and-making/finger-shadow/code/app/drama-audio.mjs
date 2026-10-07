export function encodePCM(samples){const buffer=new ArrayBuffer(samples.length*2),view=new DataView(buffer);for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);const bytes=new Uint8Array(buffer);let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return {base64:btoa(value),bytes};}
export function waveBlob(bytes){const buffer=new ArrayBuffer(44),view=new DataView(buffer);const str=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};str(0,'RIFF');view.setUint32(4,36+bytes.length,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,bytes.length,true);return new Blob([buffer,bytes],{type:'audio/wav'});}
export class DramaRecorder{
 constructor(){this.serial=0;this.stream=null;this.context=null;this.node=null;this.chunks=[];this.active=false;}
 async start(onLevel){
  this.cancel();const serial=this.serial;
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(serial!==this.serial){stream.getTracks().forEach(t=>t.stop());return false;}this.stream=stream;
   const context=new AudioContext({sampleRate:16000});this.context=context;this.rate=context.sampleRate;
   await context.audioWorklet.addModule(new URL('./pcm-worklet.mjs',import.meta.url));if(serial!==this.serial)return false;
   this.node=new AudioWorkletNode(context,'shadow-pcm');const source=context.createMediaStreamSource(stream),mute=context.createGain();mute.gain.value=0;source.connect(this.node);this.node.connect(mute);mute.connect(context.destination);this.source=source;this.mute=mute;
   this.chunks=[];this.length=0;this.node.port.onmessage=({data})=>{if(serial!==this.serial)return;if(data.stopped){this.drained?.();return;}if(data.samples){this.chunks.push(data.samples);this.length+=data.samples.length;const rms=Math.sqrt(data.samples.reduce((s,v)=>s+v*v,0)/data.samples.length);onLevel?.(Math.min(1,rms*6),this.length/this.rate);}};
   await context.resume();if(serial!==this.serial)return false;this.active=true;return true;
  }catch(error){if(serial===this.serial)this.cancel();throw error;}
 }
 async stop(){
  if(!this.active)throw Error('没有正在进行的录音。');this.active=false;const serial=this.serial;
  await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);this.drained=null;resolve();};this.drained=done;timer=setTimeout(done,300);this.node.port.postMessage('stop');});
  if(serial!==this.serial)throw Error('录音已取消。');const all=new Float32Array(this.length);let at=0;for(const part of this.chunks){all.set(part,at);at+=part.length;}const rate=this.rate;this.release();this.chunks=[];
  if(rate===16000)return all;
  const offline=new OfflineAudioContext(1,Math.ceil(all.length*16000/rate),16000),buffer=offline.createBuffer(1,all.length,rate);buffer.copyToChannel(all,0);const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();return (await offline.startRendering()).getChannelData(0);
 }
 snapshot(){if(this.rate!==16000||!this.active)return null;const all=new Float32Array(this.length);let at=0;for(const part of this.chunks){all.set(part,at);at+=part.length;}return all;}
 release(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.source?.disconnect();this.node?.disconnect();this.mute?.disconnect();this.context?.close().catch(()=>{});this.context=null;this.node=null;this.source=null;this.mute=null;}
 cancel(){this.serial++;this.active=false;this.drained?.();this.release();this.chunks=[];this.length=0;}
}
