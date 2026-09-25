import {chromium} from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import {once} from 'node:events';
const base=path.dirname(fileURLToPath(import.meta.url)),root=path.join(base,'rendered-film'),media=path.join(root,'media'),checks=path.join(root,'verification/film');await fs.mkdir(media,{recursive:true});await fs.mkdir(checks,{recursive:true});
const target=path.join(media,'office-envelope-silent-50s.mp4'),fps=24,frames=1200;try{await fs.access(target);throw Error('Preserve existing film before rerunning');}catch(e){if(e.code!=='ENOENT')throw e;}
const ffmpeg=spawn(process.env.FFMPEG || 'ffmpeg',['-hide_banner','-loglevel','warning','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','-','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-an',target],{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='';ffmpeg.stderr.on('data',b=>stderr+=b);const finished=once(ffmpeg,'close');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
const wanted=new Set([0,72,144,192,240,336,432,528,624,672,792,864,936,1032,1152,1199]);
try{
 await page.goto('http://127.0.0.1:8767/article-film-envelope.html');await page.waitForFunction(()=>window.filmReady,{},{timeout:90000});
 for(let frame=0;frame<frames;frame++){
  const state=await page.evaluate(t=>window.renderFilm(t),frame/fps);const jpg=await page.screenshot({type:'jpeg',quality:92});if(!ffmpeg.stdin.write(jpg))await once(ffmpeg.stdin,'drain');
  if(wanted.has(frame)){const name=`frame-${String(frame).padStart(4,'0')}.png`;await page.screenshot({path:path.join(checks,name)});samples.push({...state,frame,file:name});if(frame===72)await page.screenshot({path:path.join(media,'office-3d-poster.png')});}
  if(frame%120===0)console.log(`Rendered ${frame}/${frames} frames`);
 }
 ffmpeg.stdin.end();const [code]=await finished;if(code!==0||errors.length)throw Error(JSON.stringify({code,errors,stderr}));await fs.writeFile(path.join(root,'film-render-record.json'),JSON.stringify({status:'rendered',width:1280,height:720,fps,frames,duration_seconds:frames/fps,source:'actual office-envelope-final.glb and previous office-room-final.glb, rendered with Three.js',audio:false,generated_interpolation:false,errors,ffmpeg_stderr:stderr,samples},null,2));console.log('Film ready: '+target);
}finally{await browser.close();if(!ffmpeg.stdin.destroyed)ffmpeg.stdin.end();}
