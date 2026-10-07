// Classic worker + dynamic ESM import: the MediaPipe WASM loader needs importScripts.
let detector,palmAppearance,handBox,sampleCanvas,sampleContext,tracking='browser';
const session=crypto.randomUUID();
async function track(boxes,timeoutMs=1800){
 const response=await fetch('../api/tracking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session,boxes}),signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw Error('本机 OC-SORT 服务暂不可用');return response.json();
}
const assetRoot=new URL('../vendor/',self.location.href).href;
self.onmessage=async ({data})=>{
  try{
    if(data.type==='init'){
      const {FilesetResolver,HandLandmarker}=await import(assetRoot+'vision_bundle.mjs');
      ({palmAppearance,handBox}=await import('./hand-identity.mjs'));
      sampleCanvas=new OffscreenCanvas(192,144);sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
      const files=await FilesetResolver.forVisionTasks(assetRoot+'wasm/');
      const create=delegate=>HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:assetRoot+'hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:data.count,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
      let delegate=data.delegate==='CPU'?'CPU':'GPU';
      try{detector=await create(delegate);}catch(e){if(delegate==='CPU')throw e;delegate='CPU';detector=await create(delegate);}
      if(data.tracking==='ocsort'){try{await track([],12000);tracking='ocsort';}catch{tracking='browser';}}
      self.postMessage({type:'ready',delegate,tracking});
    }else if(data.type==='frame'){
      const start=performance.now();
      try{
        const result=detector.detectForVideo(data.frame,data.timestamp);
        const inferenceMs=performance.now()-start;
        let appearances=[];
        if(result.landmarks.length&&sampleContext){
          sampleContext.drawImage(data.frame,0,0,192,144);
          const pixels=sampleContext.getImageData(0,0,192,144).data;
          appearances=result.landmarks.map(points=>palmAppearance(pixels,192,144,points));
          sampleContext.clearRect(0,0,192,144);
        }
        let motionIds=[];const trackStart=performance.now();
        if(tracking==='ocsort'){
          try{const boxes=result.landmarks.map(points=>{const b=handBox(points);return [b.left,b.top,b.right,b.bottom];});motionIds=(await track(boxes)).motionIds;}
          catch{tracking='browser';self.postMessage({type:'tracking-fallback',message:'本机 OC-SORT 暂不可用，已切回浏览器追踪。原角色绑定保留。'});}
        }
        self.postMessage({type:'result',result,appearances,motionIds,tracking,trackingMs:performance.now()-trackStart,ms:inferenceMs,timestamp:data.timestamp});
      }
      finally{data.frame.close();}
    }
  }catch(e){self.postMessage({type:'error',message:e.message});}
};
