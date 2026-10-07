const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline');
class TTSService{
 constructor(root){this.root=root;this.child=null;this.boot=null;this.pending=new Map();this.next=0;}
 start(){if(process.platform!=='win32')return Promise.reject(Error('请使用已备好的朗读音频；本机重新合成当前仅支持 Windows。'));if(this.boot)return this.boot;this.boot=new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(this.root,'speech','tts.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;let ready=false;
  const timer=setTimeout(()=>{reject(Error('本机朗读服务准备超时。'));child.kill();},20000);child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
  readline.createInterface({input:child.stdout}).on('line',line=>{let msg;try{msg=JSON.parse(line);}catch{return;}if(msg.ready){ready=true;clearTimeout(timer);resolve();return;}const wait=this.pending.get(msg.id);if(!wait)return;clearTimeout(wait.timer);this.pending.delete(msg.id);msg.error?wait.reject(Error('本机朗读没有完成，请检查英语语音包。')):wait.resolve(msg.result);});
  const failed=()=>{clearTimeout(timer);if(!ready)reject(Error('本机英语朗读服务未能启动。'));if(this.child!==child)return;for(const wait of this.pending.values()){clearTimeout(wait.timer);wait.reject(Error('朗读服务已停止。'));}this.pending.clear();this.child=null;this.boot=null;};child.on('exit',failed);child.on('error',failed);
 });return this.boot;}
 async call(data){if(data.command!=='voices'&&(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000||typeof data.voice!=='string'||data.voice.length>150||!Number.isInteger(data.rate)||data.rate< -4||data.rate>2))throw Error('朗读文字或声音设置不正确。');await this.start();if(this.pending.size>=3)throw Error('还有朗读正在生成，请稍等。');const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.child?.kill();reject(Error('朗读生成超时。'));},60000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({...data,id})+'\n');});}
 close(){this.child?.kill();}
}
module.exports={TTSService};
