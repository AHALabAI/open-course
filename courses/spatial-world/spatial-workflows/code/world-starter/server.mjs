import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanState,decide,chat} from './ai.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT)||8795;
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png'};
let active=false,lastCall=0,calls=0;
const files=new Map([['/','public/index.html'],['/app.mjs','public/app.mjs'],['/style.css','public/style.css'],['/mini-game.html','public/mini-game.html'],['/assets/room.glb','public/assets/room.glb'],['/assets/room-render.png','public/assets/room-render.png'],['/vendor/three.module.js','node_modules/three/build/three.module.js'],['/vendor/three.core.js','node_modules/three/build/three.core.js'],['/vendor/GLTFLoader.js','node_modules/three/examples/jsm/loaders/GLTFLoader.js'],['/utils/BufferGeometryUtils.js','node_modules/three/examples/jsm/utils/BufferGeometryUtils.js']]);
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk.toString();if(Buffer.byteLength(text)>4096)throw Error('body_limit');}return JSON.parse(text);}
export const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!hosts.has(req.headers.host))return json(res,403,{error:'invalid_host'});
 const route=new URL(req.url,'http://localhost').pathname;
 if(req.method==='POST'&&['/api/decision','/api/chat'].includes(route)){
  if(!origins.has(req.headers.origin))return json(res,403,{error:'invalid_origin'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'json_required'});
  if(active||Date.now()-lastCall<2000||calls>=40)return json(res,429,{error:'cooldown_or_budget',message:'稍后重试；每次启动最多40次请求。'});
  active=true;lastCall=Date.now();
  try{
   const input=await body(req),state=cleanState(input.state);
   if(route==='/api/chat'&&(typeof input.question!=='string'||!input.question.trim()||input.question.length>300))throw Error('invalid_question');
   calls++;
   return json(res,200,route==='/api/decision'?await decide(state,process.env):await chat(input.question,state,input.history,process.env));
  }catch{return json(res,400,{error:'invalid_input'});}
  finally{active=false;}
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
 const relative=files.get(route);
 if(!relative)return json(res,404,{error:'not_found'});
 try{
  const file=path.join(root,relative),size=(await stat(file)).size;
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':size,'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:await readFile(file));
 }catch{return json(res,404,{error:'missing_file',message:'请先 npm install，再用 Blender 运行 build_scene.py。'});}
});
server.requestTimeout=20000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(`Tutorial: http://127.0.0.1:${port} — loopback only; no keys printed.`));
