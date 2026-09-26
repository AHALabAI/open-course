import * as THREE from './vendor/three.module.js';

// The animal lineup follows aha-mini-world; these meshes use this game's proportions.
export const CHARACTERS = [
  {id:'human',name:'森林探险家',sub:'戴着绿帽子，背着小书包',skin:'#e8bd8b',hat:'#88a858',color:0x8cae5b},
  {id:'fox',name:'小狐狸',sub:'尖耳朵，橙色尾巴',skin:'#f0a553',hat:'#b95b35',color:0xe9a05a},
  {id:'robot',name:'薄荷机器人',sub:'头上有一根天线',skin:'#9ccdc1',hat:'#e2edc6',color:0x85cfc0},
  {id:'rabbit',name:'白色小兔',sub:'白毛，长耳朵',skin:'#f4ede0',hat:'#e8b0b1',color:0xf4ede0},
  {id:'cat',name:'三花小猫',sub:'身上有橙色和黑色花纹',skin:'#fff4df',hat:'#dd8b38',color:0xfff4df},
  {id:'tiger',name:'威风小虎',sub:'橙色毛，黑色条纹',skin:'#efa433',hat:'#443930',color:0xefa433},
  {id:'monkey',name:'机灵小猴',sub:'圆耳朵，长尾巴',skin:'#bd9870',hat:'#795339',color:0x956540},
  {id:'panda',name:'竹林熊猫',sub:'黑眼圈，圆耳朵',skin:'#f1eee0',hat:'#35433a',color:0xf1eee0},
  {id:'penguin',name:'小小企鹅',sub:'黑白肚皮，小翅膀',skin:'#f4f0df',hat:'#49647a',color:0x49647a},
  {id:'astronaut',name:'小宇航员',sub:'戴头盔，穿太空服',skin:'#9dced1',hat:'#eeeee0',color:0xe3e5dc},
];

export function createCharacter(character) {
  const group=new THREE.Group(),materials=new Map();group.name=character.id;
  const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color}));return materials.get(color);};
  const part=(w,h,d,color,x,y,z)=>{const p=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));p.position.set(x,y,z);group.add(p);return p;};
  const skin=character.skin,body=character.color,dark='#304635',cream='#fff1d1';
  part(.7,.75,.42,body,0,.9,0);part(.68,.6,.6,skin,0,1.57,0);
  for(const side of [-1,1]){part(.24,.5,.3,body,side*.2,.3,0);part(.27,.14,.4,dark,side*.2,.1,.03);part(.23,.65,.3,body,side*.48,.94,0);}
  const eyes=(color=dark)=>{for(const side of [-1,1]){part(.09,.1,.025,color,side*.17,1.6,.32);part(.026,.026,.014,cream,side*.17-.02,1.63,.34);}};
  const muzzle=()=>{part(.29,.2,.12,cream,0,1.4,.32);part(.09,.065,.04,dark,0,1.44,.4);};
  const ears=(height=.32,color=body)=>{for(const side of [-1,1]){
    if(character.id==='rabbit'){part(.2,height,.22,color,side*.23,1.86+height/2,0);part(.08,height*.6,.024,'#eab0a7',side*.23,1.89+height/2,.123);}
    else{const triangle=(width,h,depth,c,y,z)=>{const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(0,h);shape.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat(c));mesh.position.set(side*.23,y,z);group.add(mesh);};triangle(.25,height,.22,color,1.86,-.11);triangle(.11,height*.65,.015,'#eab0a7',1.89,.115);}
  }};
  const tail=(color,length=.6)=>{const p=part(.18,.18,length,color,0,.54,-.38-length/2);p.rotation.x=.35;};
  switch(character.id){
    case 'human':part(.95,.08,.85,body,0,1.85,0);part(.72,.2,.66,body,0,1.96,0);part(.58,.64,.27,'#a6834e',0,.95,-.32);eyes();break;
    case 'fox':ears(.32);muzzle();tail(body);part(.19,.19,.2,cream,0,.7,-.9);part(.3,.48,.04,cream,0,.95,.23);eyes();break;
    case 'robot':part(.75,.16,.66,'#dbe6cf',0,1.88,0);part(.54,.18,.045,dark,0,1.61,.32);eyes('#abf5e5');part(.055,.3,.055,dark,0,2.1,0);part(.15,.15,.15,'#eace6b',0,2.28,0);part(.33,.23,.04,dark,0,1,.24);part(.15,.08,.02,'#abf5e5',0,1,.27);break;
    case 'rabbit':ears(.57);muzzle();tail(body,.18);part(.32,.45,.04,'#eed0c6',0,.95,.23);eyes();break;
    case 'cat':ears(.27);part(.28,.28,.024,'#dd8b38',-.18,1.71,.31);part(.18,.28,.024,'#383731',.24,1.71,.31);part(.22,.27,.03,'#dd8b38',-.18,.99,.23);part(.17,.19,.03,'#383731',.18,.75,.23);muzzle();for(const side of [-1,1])for(const y of [1.36,1.43])part(.2,.016,.02,dark,side*.29,y,.38);tail('#dd8b38');part(.19,.19,.18,dark,0,.7,-.91);eyes('#806523');break;
    case 'tiger':ears(.22);muzzle();tail(body);for(const side of [-1,1]){for(const y of [.72,.91,1.1])part(.18,.045,.03,dark,side*.21,y,.23);for(const y of [1.45,1.55])part(.13,.04,.025,dark,side*.29,y,.32);}part(.06,.2,.025,dark,0,1.77,.32);eyes();break;
    case 'monkey':for(const side of [-1,1]){part(.27,.3,.2,body,side*.44,1.64,0);part(.14,.16,.024,skin,side*.47,1.64,.12);}part(.41,.37,.035,skin,0,.95,.24);muzzle();{const t=new THREE.Mesh(new THREE.TorusGeometry(.27,.067,5,12,Math.PI*1.6),mat(body));t.position.set(.1,.65,-.57);group.add(t);}eyes();break;
    case 'panda':for(const side of [-1,1]){part(.23,.24,.23,dark,side*.26,1.97,0);part(.2,.22,.035,dark,side*.18,1.6,.32);part(.24,.6,.32,dark,side*.48,.92,0);}part(.73,.22,.44,dark,0,1.17,0);muzzle();eyes('#f1eee0');break;
    case 'penguin':part(.7,.14,.63,body,0,1.88,0);part(.42,.58,.04,cream,0,.94,.24);part(.25,.13,.22,'#edb445',0,1.45,.38);for(const side of [-1,1])part(.29,.12,.5,'#edb445',side*.2,.1,.09);eyes();break;
    case 'astronaut':part(.82,.76,.75,body,0,1.6,0);part(.65,.48,.05,'#3e707c',0,1.6,.4);part(.48,.27,.02,'#9dced1',-.035,1.65,.43);part(.12,.12,.02,'#e2fbf3',-.2,1.73,.45);part(.37,.24,.04,'#778b86',0,1,.25);part(.1,.07,.02,'#e8b55a',-.08,1.03,.28);part(.6,.65,.3,'#a0b4b1',0,1,-.36);break;
  }
  return group;
}

// Pixel portraits also show the species on narrow screens without a second 3D view.
export function portrait(character) {
  const c=document.createElement('canvas');c.width=c.height=40;const g=c.getContext('2d');g.fillStyle=character.skin;g.fillRect(7,12,26,23);g.fillStyle=character.hat;
  if(['fox','rabbit','cat','tiger','panda'].includes(character.id)){const h=character.id==='rabbit'?12:7;g.fillRect(8,12-h,7,h+3);g.fillRect(25,12-h,7,h+3);}
  else if(character.id==='monkey'){g.fillRect(2,17,6,10);g.fillRect(32,17,6,10);}
  else g.fillRect(6,8,28,8);
  if(character.id==='cat'){g.fillStyle='#dd8b38';g.fillRect(7,12,11,10);g.fillStyle='#383731';g.fillRect(27,12,6,12);}
  if(character.id==='panda'){g.fillStyle='#35433a';g.fillRect(10,20,8,8);g.fillRect(23,20,8,8);}
  if(character.id==='tiger'){g.fillStyle='#443930';g.fillRect(18,12,4,8);g.fillRect(7,28,6,3);g.fillRect(27,28,6,3);}
  if(character.id==='robot'||character.id==='astronaut'){g.fillStyle='#365d63';g.fillRect(9,18,22,11);}
  g.fillStyle=character.id==='panda'||character.id==='robot'?'#ddf9ef':'#263d33';g.fillRect(12,22,4,4);g.fillRect(25,22,4,4);
  if(character.id==='penguin'){g.fillStyle='#edb445';g.fillRect(17,29,8,4);}
  return c.toDataURL();
}
