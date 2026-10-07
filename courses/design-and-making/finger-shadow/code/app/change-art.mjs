// Source coordinates in the untouched 1254 × 1254 Chang'e atlas.
// Some adjacent parts share a narrow horizontal band; source-space clipping
// keeps each object intact without copying a fragment of its neighbour.
export const CHANGE_SHEET = {
  file: 'change-atlas-v1.png',
  k: .225, headK: .20, armK: [.18, .18], legK: [.20, .20],
  root: [674, 238],
  body: [483, 0, 407, 454, [[505,0],[890,0],[890,454],[483,454],[483,355],[505,355]]],
  head: [0, 0, 483, 454],
  neck: [673, 55], headPivot: [379, 402],
  shoulders: [[564, 94], [785, 94]],
  hips: [[597, 424], [785, 424]],
  arms: [
    [[955, 0, 299, 477, [[955, 0], [1254, 0], [1254, 477], [1070, 477], [1070, 454], [955, 454]]], [1001, 42]],
    [[63, 452, 285, 478, [[63, 452], [348, 452], [348, 930], [182, 930], [182, 904], [63, 904]]], [298, 488]]
  ],
  armTips: [[1094, 449], [268, 902]],
  legs: [
    [[500, 458, 313, 440], [661, 488]],
    [[913, 458, 298, 438], [1003, 488]]
  ],
  legTips: [[700, 875], [1007, 868]],
  props: [
    [52, 900, 364, 354, [[52, 900], [182, 900], [182, 931], [416, 931], [416, 1254], [52, 1254]]],
    [446, 901, 417, 353],
    [893, 896, 361, 358]
  ],
  // Put the handle in the hand, rather than the centre of the ornament.
  propPivots: [[116, 947], [727, 1158], [1134, 1145]],
  propScales: [.16, .15, .16],
  names: ['月宫花灯', '桂花枝', '玉兔团扇']
};
