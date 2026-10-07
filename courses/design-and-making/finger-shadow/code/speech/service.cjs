const {spawn}=require('child_process'),path=require('path'),fs=require('fs'),readline=require('readline');
class SpeechService{
 constructor(root){this.root=root;this.pending=new Map();this.next=0;this.child=null;this.boot=null;}
 start(){
  if(this.boot)return this.boot;
  const python=process.env.SHADOW_SPEECH_PYTHON||path.join(this.root,'.venv-speech',...(process.platform==='win32'?['Scripts','python.exe']:['bin','python']));
  if(!fs.existsSync(python))return Promise.reject(Error('本机语音环境尚未准备好。'));
  this.boot=new Promise((resolve,reject)=>{
   const child=spawn(python,['-u',path.join(this.root,'speech','worker.py')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',OMP_NUM_THREADS:'4'}});
   this.child=child;let ready=false;const timer=setTimeout(()=>{reject(Error('语音服务启动超时。'));child.kill();},30000);
   child.stderr.on('data',()=>{}); // Do not log student audio or transcripts.
   readline.createInterface({input:child.stdout}).on('line',line=>{
    let msg;try{msg=JSON.parse(line);}catch{return;}
    if(msg.ready){ready=true;clearTimeout(timer);resolve();return;}
    const wait=this.pending.get(msg.id);if(!wait)return;this.pending.delete(msg.id);clearTimeout(wait.timer);
    msg.error?wait.reject(Error(msg.error)):wait.resolve(msg.result);
   });
   const failed=()=>{clearTimeout(timer);if(!ready)reject(Error('本机语音服务无法启动。'));if(this.child!==child)return;for(const wait of this.pending.values()){clearTimeout(wait.timer);wait.reject(Error('语音服务已停止，请重试。'));}this.pending.clear();this.child=null;this.boot=null;};
   child.on('exit',failed);child.on('error',failed);child.stdin.on('error',()=>{});
  });return this.boot;
 }
 async call(data){
  if(!['status','prepare'].includes(data.command)&&(data.sampleRate!==16000||typeof data.reference!=='string'||data.reference.length>400||!data.reference.trim()||typeof data.pcm!=='string'||data.pcm.length>1066672||!data.pcm.length))throw Error('录音或台词格式不正确。');
  await this.start();if(this.pending.size>=3)throw Error('还有录音正在处理，请稍等再试。');
  const id=++this.next;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.child?.kill();reject(Error('语音处理超时，请重试。'));},90000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({...data,id})+'\n');});
 }
 close(){this.child?.kill();}
}
module.exports={SpeechService};
