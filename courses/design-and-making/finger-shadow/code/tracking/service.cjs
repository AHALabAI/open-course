const {spawn}=require('child_process'),path=require('path'),fs=require('fs'),readline=require('readline');
class TrackingService{
 constructor(root){this.root=root;this.pending=new Map();this.next=0;this.process=null;this.boot=null;}
 start(){
  if(this.boot)return this.boot;
  const python=process.env.SHADOW_TRACKING_PYTHON||path.join(this.root,'.venv-tracking',...(process.platform==='win32'?['Scripts','python.exe']:['bin','python']));
  if(!fs.existsSync(python))return Promise.reject(Error('OC-SORT 环境未准备好'));
  this.boot=new Promise((resolve,reject)=>{
   const child=spawn(python,['-u',path.join(this.root,'tracking','ocsort_bridge.py')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1',OPENBLAS_NUM_THREADS:'1'}});this.process=child;
   let ready=false,diagnostic='';const timer=setTimeout(()=>{reject(Error('OC-SORT 启动超时'));child.kill();},10000);
   child.stderr.on('data',data=>{diagnostic=(diagnostic+data.toString()).slice(-2000);});
   readline.createInterface({input:child.stdout}).on('line',line=>{
    let message;try{message=JSON.parse(line);}catch{return;}
    if(message.ready){ready=true;clearTimeout(timer);resolve();return;}
    const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);clearTimeout(waiter.timer);
    message.error?waiter.reject(Error(message.error)):waiter.resolve(message);
   });
   const failed=()=>{clearTimeout(timer);if(!ready)reject(Error(diagnostic||'OC-SORT 无法启动'));for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('OC-SORT 已停止'));}this.pending.clear();this.process=null;this.boot=null;};
   child.on('error',failed);child.on('exit',failed);child.stdin.on('error',()=>{});
  });return this.boot;
 }
 async update(data){
  if(typeof data.session!=='string'||data.session.length>100||!Array.isArray(data.boxes)||data.boxes.length>10||data.boxes.some(b=>!Array.isArray(b)||b.length!==4||b.some(n=>!Number.isFinite(n)||n<-.25||n>1.25)||b[2]<=b[0]||b[3]<=b[1]))throw Error('追踪输入无效');
  await this.start();if(this.pending.size>=12)throw Error('追踪请求过多');
  const id=++this.next;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('追踪响应超时'));},1500);
   this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({id,session:data.session,boxes:data.boxes})+'\n');
  });
 }
 close(){this.process?.kill();}
}
module.exports={TrackingService};
