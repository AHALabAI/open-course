class PCMCollector extends AudioWorkletProcessor{
 constructor(){super();this.buffer=new Float32Array(4096);this.count=0;this.active=true;this.port.onmessage=({data})=>{if(data==='stop'){this.flush();this.active=false;this.port.postMessage({stopped:true});}};}
 flush(){if(this.count){const samples=this.buffer.slice(0,this.count);this.port.postMessage({samples},[samples.buffer]);this.count=0;}}
 process(inputs){if(!this.active)return false;const channels=inputs[0];if(channels?.length){const n=channels[0].length;for(let i=0;i<n;i++){let value=0;for(const c of channels)value+=c[i]||0;this.buffer[this.count++]=value/channels.length;if(this.count===this.buffer.length)this.flush();}}return true;}
}
registerProcessor('shadow-pcm',PCMCollector);
