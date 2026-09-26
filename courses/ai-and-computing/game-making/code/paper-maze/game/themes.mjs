// Stable numeric IDs preserve previously exported classroom projects.
export const THEMES = [
  {name:'苔藓森林',wall:'#577c57',light:'#6e946a',mortar:'#415f49',floor:'#b3ab7e',sky:'#a8c4ad',fog:'#92ad94',cap:'#688451'},
  {name:'砂岩庭院',wall:'#bc9769',light:'#d4b17a',mortar:'#977851',floor:'#c4b28b',sky:'#c8d4b9',fog:'#bdc4a0',cap:'#d5b57e'},
  {name:'薄荷水晶',wall:'#6d9196',light:'#93b4b1',mortar:'#52757e',floor:'#92aaa3',sky:'#b2d5d0',fog:'#9abebd',cap:'#9ac8c2'},
  {name:'樱花花园',wall:'#b7778f',light:'#dda4b6',mortar:'#915b73',floor:'#eed6c7',sky:'#f2dce6',fog:'#dcb9ca',cap:'#e9b7c9'},
  {name:'冰雪城堡',wall:'#7aabc2',light:'#c0e3ef',mortar:'#5c879e',floor:'#e0edf1',sky:'#d7eafa',fog:'#bedbea',cap:'#d0eaf4'},
  {name:'海底蓝境',wall:'#397e9f',light:'#6eacc0',mortar:'#2c607c',floor:'#ccb98c',sky:'#9bcdda',fog:'#6ba8bf',cap:'#76b8c8'},
  {name:'枫叶秋日',wall:'#b67748',light:'#dca366',mortar:'#8b5637',floor:'#d9bd7f',sky:'#eadfc0',fog:'#d4b58c',cap:'#cc934b'},
  {name:'薰衣草谷',wall:'#8c7aac',light:'#b7a4d0',mortar:'#6a5c89',floor:'#c9c6da',sky:'#ddd7f0',fog:'#bcb0d2',cap:'#bca1d2'},
  {name:'火山岩城',wall:'#765f56',light:'#a6856b',mortar:'#504440',floor:'#b89578',sky:'#efd0b0',fog:'#c69d82',cap:'#d79357'},
  {name:'云朵乐园',wall:'#b4aa84',light:'#e8dfbb',mortar:'#8c8467',floor:'#f0e7d5',sky:'#c5e3ef',fog:'#d8e4d5',cap:'#ede4c6'},
  {name:'月光基地',wall:'#647790',light:'#93aac0',mortar:'#46566e',floor:'#a5acb6',sky:'#8796b2',fog:'#8b9cb5',cap:'#adc3d6'},
  {name:'蜜桃糖果屋',wall:'#c48270',light:'#eab5a0',mortar:'#9f6558',floor:'#f0d9b4',sky:'#f7e0cf',fog:'#e3bfa8',cap:'#efd095'},
];
export const validTheme = value => Number.isInteger(value) && value >= 0 && value < THEMES.length;
