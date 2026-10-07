const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname;
const {TrackingService}=require('./tracking/service.cjs');
const {SpeechService}=require('./speech/service.cjs');
const {TTSService}=require('./speech/tts.cjs');
function createServer(){const tracking=new TrackingService(root),speech=new SpeechService(root),speechLive=new SpeechService(root),tts=new TTSService(root);const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(pathname.startsWith('/api/tts/')){
    const host=req.headers.host||'',origin=req.headers.origin;
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||(origin&&origin!=='http://'+host)){res.writeHead(403).end();return;}
    const send=(code,data)=>{if(!res.writableEnded)res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));};
    if(pathname==='/api/tts/voices'&&req.method==='GET'){tts.call({command:'voices'}).then(data=>send(200,data),error=>send(503,{error:error.message}));return;}
    if(pathname!=='/api/tts/synthesize'||req.method!=='POST'||!/^application\/json\b/.test(req.headers['content-type']||'')){send(405,{error:'请求方式不正确。'});return;}
    let body='',large=false;req.on('data',part=>{body+=part;if(body.length>15000&&!large){large=true;send(413,{error:'朗读文字太长。'});req.destroy();}});req.on('end',async()=>{if(large)return;try{const data=JSON.parse(body);send(200,await tts.call({command:'synthesize',text:data.text,voice:data.voice,rate:data.rate}));}catch(error){send(503,{error:error.message});}});return;
  }
  if(pathname.startsWith('/api/speech/')){
    const host=req.headers.host||'',origin=req.headers.origin;
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||(origin&&origin!=='http://'+host)){res.writeHead(403).end();return;}
    const send=(code,data)=>{if(!res.writableEnded)res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));};
    if(pathname==='/api/speech/status'&&req.method==='GET'){speech.call({command:'status'}).then(data=>send(200,data),error=>send(503,{error:error.message}));return;}
    if(pathname==='/api/speech/prepare'&&req.method==='POST'){speechLive.call({command:'prepare'}).then(data=>send(200,data),error=>send(503,{error:error.message}));return;}
    if(!['/api/speech/assess','/api/speech/transcribe','/api/speech/preview'].includes(pathname)||req.method!=='POST'||!/^application\/json\b/.test(req.headers['content-type']||'')){send(405,{error:'请求方式不正确。'});return;}
    let body='',large=false;req.on('data',part=>{body+=part;if(body.length>1100000&&!large){large=true;send(413,{error:'录音太长。'});req.destroy();}});
    req.on('end',async()=>{if(large)return;try{const data=JSON.parse(body),command=pathname.split('/').pop();send(200,await speechLive.call({command,pcm:data.pcm,sampleRate:data.sampleRate,reference:data.reference}));}catch(error){send(503,{error:error.message});}});return;
  }
  if(pathname==='/api/tracking'){
    const origin=req.headers.origin;
    if(req.method!=='POST'||!/^application\/json\b/.test(req.headers['content-type']||'')||(origin&&origin!=='http://'+req.headers.host)){res.writeHead(403).end();return;}
    let body='',tooLarge=false;req.on('data',part=>{body+=part;if(body.length>10000){tooLarge=true;res.writeHead(413).end();req.destroy();}});
    req.on('end',async()=>{if(tooLarge)return;try{const result=await tracking.update(JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));}catch(error){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:error.message}));}});return;
  }
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(path.relative(root,file).split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
    const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.jpg':'image/jpeg','.png':'image/png','.wav':'audio/wav','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);
  });
});server.on('close',()=>{tracking.close();speech.close();speechLive.close();tts.close();});return server;}
module.exports={createServer};
if(require.main===module){const server=createServer();server.listen(Number(process.env.PORT||8773),'127.0.0.1',()=>console.log('指间影戏：http://127.0.0.1:'+server.address().port));server.on('error',e=>{console.error(e.message);process.exitCode=1;});}
