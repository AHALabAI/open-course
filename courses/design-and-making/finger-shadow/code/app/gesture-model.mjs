// Instance-based learner for classroom experiments. Neighbor agreement is not calibrated confidence.
export const LABELS=['open','pinch','fist','other'];
export class GestureModel {
  constructor(){this.samples=[];}
  add(label,features){if(!LABELS.includes(label)||features.length!==5||features.some(v=>!Number.isFinite(v)))throw Error('Invalid gesture sample');this.samples.push({label,features:[...features]});}
  counts(){return Object.fromEntries(LABELS.map(label=>[label,this.samples.filter(s=>s.label===label).length]));}
  ready(){return Object.values(this.counts()).every(n=>n>=20);}
  predict(features){
    if(!this.ready()||features?.length!==5||features.some(v=>!Number.isFinite(v)))return {label:'unknown',agreement:0};
    const neighbors=this.samples.map(s=>({...s,distance:Math.sqrt(s.features.reduce((sum,v,i)=>sum+(v-features[i])**2,0)/5)})).sort((a,b)=>a.distance-b.distance);
    const top=neighbors.slice(0,5),votes={};top.forEach(n=>votes[n.label]=(votes[n.label]||0)+1);const [label,count]=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
    const nearestOther=neighbors.find(s=>s.label!==label),agreement=count/5;
    const reject=top[0].distance>.22||agreement<.8||(nearestOther&&nearestOther.distance-top[0].distance<.035);
    return {label:reject?'unknown':label,agreement,distance:top[0].distance};
  }
}
