// Garden paths surrounding the Explorer Hall.
export const OUTDOOR_RECTS=[[-22,11,24,24],[-22,-16,24,-7],[-22,-7,-11,11],[16,-7,24,11]];
export const TREES=[[-19,19],[-15,21],[-9,21],[-3,22],[7,22],[16,21],[22,20],[22,13],[22,5],[22,-3],[20,-12],[12,-13],[3,-13],[-7,-13],[-18,-12],[-19,-5],[-19,3],[-18,10]];
export const BENCHES=[{x:-10,z:15,angle:0},{x:-10,z:18,angle:Math.PI},{x:19,z:4,angle:Math.PI/2}];
export const OUTDOOR_RESOURCES=[['wood',-15,13,2],['wood',-18,-8,2],['wood',20,15,2],['stone',17,19,2],['stone',14,-11,2],['food',-6,18,1],['food',20,-7,1]];
export function outdoorFloor(x,z){return OUTDOOR_RECTS.some(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1);}
export function outdoorBlocked(x,z){return TREES.some(([tx,tz])=>Math.hypot(x-tx,z-tz)<.6)||BENCHES.some(b=>Math.abs(x-b.x)<(b.angle===Math.PI/2?.6:1.6)&&Math.abs(z-b.z)<(b.angle===Math.PI/2?1.6:.6))||(Math.abs(x+10)<1.3&&Math.abs(z-16.5)<.85);}
