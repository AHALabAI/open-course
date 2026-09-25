import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {attachRoom} from '../room.mjs';

test('two guests join one room; chat stays data; foreign origins rejected',async()=>{
 const server=http.createServer();
 attachRoom(server);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port,origin=`http://127.0.0.1:${port}`,sockets=[];
 function connect(o=origin){const ws=new WebSocket(`ws://127.0.0.1:${port}/room`,{origin:o});sockets.push(ws);return ws;}
 function until(ws,predicate){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',on);reject(Error('room response timeout'));},3000);
  function on(raw){const m=JSON.parse(raw);if(predicate(m)){clearTimeout(timer);ws.off('message',on);resolve(m);}}
  ws.on('message',on);
 });}
 try{
  const a=connect();await once(a,'open');let ready=until(a,m=>m.type==='welcome');a.send(JSON.stringify({type:'join',name:'Explorer A'}));await ready;
  const b=connect();await once(b,'open');ready=until(a,m=>m.type==='world'&&m.players.length===2);b.send(JSON.stringify({type:'join',name:'Explorer B'}));await ready;
  ready=until(b,m=>m.type==='chat'&&m.name==='Explorer A');a.send(JSON.stringify({type:'chat',message:'<b>hello</b>'}));assert.equal((await ready).message,'<b>hello</b>');
  const rejected=connect('https://example.invalid');const [code]=await once(rejected,'close');assert.equal(code,1008);
 }finally{for(const ws of sockets)ws.terminate();await new Promise(resolve=>server.close(resolve));}
});
