from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parent
views=json.loads((root/'runs/office-v01/cameras.json').read_text())
intr={int(s[0]):dict(zip(['width','height','fx','fy','cx','cy'],map(float,s[2:]))) for l in (root/'runs/office-v01/dense/sparse/cameras.txt').read_text().splitlines() if l and not l.startswith('#') for s in [l.split()]}
cases=[]
for key,title,filename in [('room','房间整体','6_REN0298.jpg'),('chairs','桌椅与桌上物件','6_REN0163.jpg'),('door','门及邻近墙面','3_REN0406.jpg'),('screens','显示屏','4_REN0055.jpg'),('screenwide','显示屏方向全景','6_REN0730.jpg'),('doorwide','门口方向全景','6_REN0460.jpg'),('corner','墙角与桌边','6_REN0271.jpg'),('side','侧面空间关系','6_REN0595.jpg')]:
 v=next(x for x in views if x['image']==filename).copy();v.update(key=key,title=title,intrinsics=intr[int(filename.split('_')[0])]);cases.append(v);shutil.copy2(root/'source/images'/filename,root/'viewer/assets'/filename)
(root/'viewer/assets/article-photo-views.json').write_text(json.dumps(cases,indent=2),encoding='utf-8');print('Prepared eight calibrated photo/render comparisons')
