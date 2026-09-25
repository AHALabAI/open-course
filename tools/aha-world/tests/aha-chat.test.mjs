import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPlayerStatus,chatMessages,askDeepSeek} from '../aha-chat.mjs';
const context={question:'@AHA 下一步做什么',asker:{name:'猫'},players:[{name:'猫',vitals:{health:42}}],shared:{fire:false},history:Array.from({length:30},(_,i)=>({name:'猫',message:String(i)}))};
test('chat context contains rules, state and bounded history, not credentials',()=>{
 const messages=chatMessages(context);
 assert.equal(messages[0].role,'system');assert.match(messages[0].content,/180/);
 const data=JSON.parse(messages[1].content);assert.equal(data.chatHistory.length,20);assert.equal(data.players[0].vitals.health,42);
});
test('client status is bounded and unknown fields discarded',()=>{
 const s=cleanPlayerStatus({health:999,hunger:-3,inventory:{wood:Infinity},key:'secret'});
 assert.equal(s.health,100);assert.equal(s.hunger,0);assert.equal(s.inventory.wood,null);assert.equal(s.key,undefined);
});
test('missing key does not call provider',async()=>{
 const result=await askDeepSeek(context,{},()=>{throw Error('should not call');});assert.equal(result.ok,false);
});
test('provider receives context and token only in authorization header',async()=>{
 const result=await askDeepSeek(context,{deepseekKey:'test-key'},async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-key');
  assert.equal(options.body.includes('test-key'),false);assert.equal(JSON.parse(options.body).messages.length,3);
  return {ok:true,json:async()=>({choices:[{message:{content:'先补水。'}}]})};
 });assert.deepEqual(result,{ok:true,text:'先补水。',model:'deepseek-flash'});
});
test('upstream error bodies are never forwarded',async()=>{
 const result=await askDeepSeek(context,{deepseekKey:'test'},async()=>({ok:false,status:401,json:async()=>({key:'secret'})}));assert.equal(result.ok,false);assert.equal(result.text.includes('secret'),false);
});
