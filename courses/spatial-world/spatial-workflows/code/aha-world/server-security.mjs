import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
export function allowedOrigin(origin,host,{production=process.env.NODE_ENV==='production',publicOrigin=process.env.PUBLIC_ORIGIN||''}={}){
 if(production)return origin===publicOrigin;
 if(!origin)return true;try{const u=new URL(origin);return ['http:','https:'].includes(u.protocol)&&u.host===host;}catch{return false;}
}
export function rateLimiter(max=120,windowMs=60000){const buckets=new Map();return key=>{const now=Date.now();let b=buckets.get(key);if(!b||now>=b.until){if(buckets.size>=10000){for(const [k,v] of buckets)if(now>=v.until)buckets.delete(k);if(buckets.size>=10000&&!b)return false;}b={count:0,until:now+windowMs};buckets.set(key,b);}return ++b.count<=max;};}
export function clientAddress(req){return process.env.TRUST_PROXY_HEADERS==='1'?(String(req.headers['x-real-ip']||req.socket.remoteAddress).slice(0,80)):req.socket.remoteAddress;}
export function dailyBudget(directory,limit=200){let chain=Promise.resolve();return kind=>{const result=chain.then(async()=>{try{await mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,'ai-budget.json');let budget={};try{budget=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')return false;}const day=new Date().toISOString().slice(0,10);if(budget.day!==day)budget={day};if((budget[kind]||0)>=limit)return false;budget[kind]=(budget[kind]||0)+1;await writeFile(file+'.tmp',JSON.stringify(budget),{mode:0o600});await rename(file+'.tmp',file);return true;}catch{return false;}});chain=result.catch(()=>{});return result;};}
