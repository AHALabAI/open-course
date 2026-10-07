import {amplifyThumb} from './thumb-control.mjs';
// Physical inputs stay in anatomical order: thumb + [index, middle, ring, pinky].
// Rendering uses the middle as the head, inner pair as arms, outer pair as legs.
export const FINGER_LABELS=['拇指 · 左腿','食指 · 左臂','中指 · 头','无名指 · 右臂','小指 · 右腿'];
export const THREAD_COLUMNS=[2,1,3,0,4]; // head, left arm, right arm, left leg, right leg
export function fingerPose(p){const f=p.fingers||[.5,.5,.5,.5];return {head:f[1]??.5,limbs:[f[0]??.5,f[2]??.5,amplifyThumb(p.thumb??.5,p.thumbGain??1),f[3]??.5]};}
