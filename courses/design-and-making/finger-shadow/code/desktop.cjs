const {app,BrowserWindow,screen,globalShortcut,session}=require('electron');
const {createServer}=require('./serve.cjs');
const fs=require('fs'),path=require('path');
const smoke=process.argv.includes('--smoke-test');
let server,controls,overlay;
app.setName('手指皮影戏');
app.whenReady().then(async()=>{
  server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  session.defaultSession.setPermissionRequestHandler((wc,permission,callback,details)=>callback(wc===controls?.webContents&&wc.getURL().startsWith(origin+'/app/')&&permission==='media'&&details.mediaTypes?.includes('video')&&!details.mediaTypes?.includes('audio')));
  session.defaultSession.setPermissionCheckHandler((wc,permission,requestOrigin)=>wc===controls?.webContents&&requestOrigin===origin&&permission==='media');
  const area=screen.getPrimaryDisplay().workArea;
  overlay=new BrowserWindow({...area,frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,skipTaskbar:true,focusable:false,resizable:false,show:!smoke,hasShadow:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  overlay.setIgnoreMouseEvents(true,{forward:true});
  controls=new BrowserWindow({width:1180,height:850,show:!smoke,webPreferences:{contextIsolation:true,nodeIntegration:false}});
  for(const win of [controls,overlay]){
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/'))e.preventDefault();});
  }
  await Promise.all([overlay.loadURL(origin+'/app/overlay.html'),controls.loadURL(origin+'/app/index.html')]);
  const updateBounds=()=>{if(!overlay.isDestroyed())overlay.setBounds(screen.getPrimaryDisplay().workArea);};
  screen.on('display-metrics-changed',updateBounds);
  globalShortcut.register('CommandOrControl+Shift+Q',()=>app.quit());
  globalShortcut.register('CommandOrControl+Shift+H',()=>overlay.isVisible()?overlay.hide():overlay.showInactive());
  controls.on('closed',()=>app.quit());
  if(smoke){
    await new Promise(r=>setTimeout(r,1200));
    const state=await overlay.webContents.executeJavaScript('({count:window.shadowCount,transparent:getComputedStyle(document.body).backgroundColor})');
    const report={pass:state.count===1&&state.transparent==='rgba(0, 0, 0, 0)',state,workArea:area,note:'Hidden-window smoke test only. Camera and physical DPI placement are not measured.'};
    fs.mkdirSync(path.join(__dirname,'tests'),{recursive:true});fs.writeFileSync(path.join(__dirname,'tests/desktop-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));app.exit(report.pass?0:1);
  }
});
app.on('will-quit',()=>{globalShortcut.unregisterAll();server?.close();});
app.on('window-all-closed',()=>app.quit());
