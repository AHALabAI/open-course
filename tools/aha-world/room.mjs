import {allowedOrigin} from './server-security.mjs';
import {WebSocketServer,WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {cleanPlayerStatus} from './aha-chat.mjs';
export function lanAddresses(port){return [...new Set(Object.entries(networkInterfaces()).filter(([name])=>! /vEthernet|virtual|vmware|loopback|docker|wsl|meta|tun|tap/i.test(name)).flatMap(([,items])=>items||[]).filter(n=>n.family==='IPv4'&&!n.internal&&!n.address.startsWith('169.254.')&&!n.address.startsWith('198.18.')).map(n=>`http://${n.address}:${port}`))];}
// One classroom-sized room. Authoritative ownership, building and combat events;
// clients interpolate avatars. Nicknames are guest identities, not password accounts.
export function attachRoom(server,{askAha,feedback,reserveBudget=async()=>true}={}){
  const wss=new WebSocketServer({server,path:'/room',maxPayload:4096});
  const players=new Map(),blocks=new Map(),taken=new Set();let host=null,revision=0;
  let shared={fire:false,beacon:false,started:Date.now(),enemyHp:[3,3,3]};
  const history=[];const session=randomUUID();let aiBusy=0,aiCalls=0;
  function chat(name,message,ai=false,by=null){const mentions=[...players.values()].filter(p=>message.includes(`@${p.name}`)).map(p=>p.id);const entry={name,message,ai,by,mentions};history.push(entry);if(history.length>20)history.shift();broadcast({type:'chat',...entry});}
  function broadcast(message){const text=JSON.stringify(message);for(const c of wss.clients)if(c.readyState===WebSocket.OPEN)c.send(text);}
  function snapshot(){return {type:'world',revision,players:[...players.values()].map(({id,name,avatar,x,z,floor,rotation,vitals})=>({id,name,avatar,x,z,floor,rotation,vitals})),blocks:[...blocks.values()],taken:[...taken],shared:{...shared,elapsed:(Date.now()-shared.started)/1000}};}
  wss.on('connection',(ws,req)=>{
    ws.on('error',()=>ws.terminate());
    const origin=req.headers.origin;if(!allowedOrigin(origin,req.headers.host)){ws.close(1008,'Origin denied');return;}
    if(players.size>=8||wss.clients.size>32){ws.close(1008,'Room full');return;}
    const id=randomUUID();let joined=false,budget=0,budgetTime=Date.now();
    const joinTimeout=setTimeout(()=>{if(!joined)ws.close(1008,'Join timeout');},10000);joinTimeout.unref();
    ws.on('message',async raw=>{
      if(Date.now()-budgetTime>1000){budget=0;budgetTime=Date.now();}if(++budget>40)return;
      let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m!=='object'||Array.isArray(m))return;
      if(m.type==='join'&&!joined){
        let name=String(m.name||'探险家').replace(/[<>@\x00-\x1f]/g,'').slice(0,16).trim()||'探险家';
        if(/^aha$/i.test(name))name='探险家';
        if([...players.values()].some(p=>p.name===name))name=`${name.slice(0,10)}-${id.slice(0,4)}`;
        const avatar=['human','rabbit','fox','cat','tiger','monkey','robot'].includes(m.avatar)?m.avatar:'human';
        if(players.size>=8){ws.close(1008,'Room full');return;}
        if(!host){host=id;shared.started=Date.now();}players.set(id,{id,name,avatar,x:0,z:11,floor:0,rotation:0,last:Date.now(),ws});joined=true;
        ws.send(JSON.stringify({type:'welcome',id,host,room:'AHA-01'}));broadcast({type:'chat',name:'世界',message:`${name} 加入了 AHA 空间。`});broadcast(snapshot());return;
      }
      const p=players.get(id);if(!p)return;
      if(m.type==='move'){
        if(![m.x,m.z,m.rotation].every(Number.isFinite)||![0,1,2,3].includes(m.floor)||Math.abs(m.x)>25||Math.abs(m.z)>25)return;
        const dt=Math.min(2,(Date.now()-p.last)/1000+.15);
        // Floor transitions use the game's landing interaction; reject large same-floor jumps.
        if(p.floor===m.floor&&Math.hypot(m.x-p.x,m.z-p.z)>dt*15)return;
        Object.assign(p,{x:m.x,z:m.z,floor:m.floor,rotation:m.rotation,last:Date.now()});
      }else if(m.type==='chat'){
        if(Date.now()-(p.chatWindow||0)>60000){p.chatWindow=Date.now();p.chatCount=0;}if((p.chatCount=(p.chatCount||0)+1)>12)return;
        const message=String(m.message||'').replace(/[\x00-\x1f]/g,'').slice(0,240).trim();if(!message)return;
        const turn=randomUUID();p.vitals=cleanPlayerStatus(m.state);chat(p.name,message,false,id);
        feedback?.record({id:turn,session,playerId:id,type:/(^|\s)@aha\b/i.test(message)?'AI问答-玩家':'房间聊天',role:p.avatar,text:message,state:{floor:p.floor,...p.vitals}});
        if(!/(^|\s)@aha\b/i.test(message))return;
        const privateReply=message=>ws.readyState===WebSocket.OPEN&&ws.send(JSON.stringify({type:'chat',name:'AHA',message,ai:true}));
        if(aiBusy>=2||Date.now()-(p.lastAsk||0)<5000){privateReply('请稍等上一条回答，5 秒后可再次提问。');return;}
        if(aiCalls>=200){privateReply('本次服务的 AI 问答额度已用完，请联系主机。');return;}
        p.lastAsk=Date.now();aiBusy++;if(!await reserveBudget('deepseek')){aiBusy--;privateReply('今日 AI 问答额度已用完。');return;}aiCalls++;privateReply('正在结合房间状态思考…');
        try{
          const result=askAha?await askAha({question:message,asker:{id:p.id,name:p.name},players:[...players.values()].map(({id,name,avatar,x,z,floor,vitals})=>({id,name,avatar,x,z,floor,vitals})),shared:{...shared,elapsed:(Date.now()-shared.started)/1000},history:[...history]}):{ok:false,text:'主机尚未启用 AI 问答。'};
          if(result.ok){chat('AHA',`@${p.name} ${result.text}`,true);feedback?.record({session,parentId:turn,playerId:id,type:'AI问答-回复',role:'AHA',text:result.text,model:result.model||'DeepSeek',state:{floor:p.floor,...p.vitals}});}else{privateReply(result.text);feedback?.record({session,parentId:turn,playerId:id,type:'AI问答-失败',role:'AHA',text:result.text,model:'DeepSeek'});}
        }catch{privateReply('AI 问答暂不可用，请稍后重试。');}finally{aiBusy--;}
      }else if(m.type==='status'){
        p.vitals=cleanPlayerStatus(m.state);
      }else if(m.type==='build'){
        const b=m.block;if(!b||![b.x,b.z].every(Number.isFinite)||b.floor!==p.floor||Math.hypot(b.x-p.x,b.z-p.z)>4||!['wood','stone'].includes(b.type)||blocks.size>=200)return;
        const key=`${b.floor}:${b.x}:${b.z}`;if(blocks.has(key))return;
        blocks.set(key,{id:key,owner:id,x:b.x,z:b.z,floor:b.floor,type:b.type});revision++;broadcast(snapshot());
      }else if(m.type==='remove'){
        const b=blocks.get(m.id);if(b&&b.owner===id&&b.floor===p.floor&&Math.hypot(b.x-p.x,b.z-p.z)<4){blocks.delete(m.id);revision++;broadcast(snapshot());}
      }else if(m.type==='collect'){
        const k=String(m.id||'');if(!k||k.length>80||taken.size>=1000)return;if(taken.has(k)){ws.send(JSON.stringify({type:'collect-denied',id:k}));return;}taken.add(k);broadcast({type:'collected',id:k,by:id});
      }else if(m.type==='fire'||m.type==='beacon'){
        shared[m.type]=true;broadcast(snapshot());
      }else if(m.type==='hit'){
        const i=m.enemy;if(!Number.isInteger(i)||i<0||i>2||Date.now()-(p.hitAt||0)<450)return;p.hitAt=Date.now();shared.enemyHp[i]=Math.max(0,shared.enemyHp[i]-1);broadcast({type:'enemy',hp:shared.enemyHp,by:id});
      }else if(m.type==='restart'&&id===host){taken.clear();shared={fire:false,beacon:false,started:Date.now(),enemyHp:[3,3,3]};revision++;broadcast({type:'restart'});broadcast(snapshot());}
    });
    ws.on('close',()=>{clearTimeout(joinTimeout);const p=players.get(id);players.delete(id);if(host===id)host=players.keys().next().value||null;if(p)broadcast({type:'chat',name:'世界',message:`${p.name} 离开了房间。`});broadcast({type:'host',host});broadcast(snapshot());});
  });
  const timer=setInterval(()=>{if(players.size)broadcast(snapshot());},100);timer.unref();
  return {wss};
}
