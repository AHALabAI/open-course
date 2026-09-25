from pathlib import Path
import sys,json,shutil
root=Path(__file__).resolve().parent;sys.path.insert(0,str(root.parent))
from pilot import execute,config,sha256
out=root/'repairs/table-v01';cfg=config()
execute([Path(cfg['openmvs_bin'])/'TextureMesh.exe','scene_dense.mvs','-m',out/'scene_table_repaired.ply','-o',out/'scene_textured.mvs','--export-type','glb','--max-texture-size','4096','--max-threads','12','--global-seam-leveling','0','--local-seam-leveling','0'],root/'runs/office-v01/mvs',out/'logs/texture.log')
glb=out/'office-table-repaired.glb'
execute([sys.executable,root.parent/'pack_glb.py',out/'scene_textured.glb',glb],out,out/'logs/pack.log')
execute([sys.executable,root.parent.parent/'check_glb.py',glb,'--require-texture'],out,out/'logs/check.log')
shutil.copy2(glb,root/'viewer/assets'/glb.name)
(out/'asset.json').write_text(json.dumps({'file':glb.name,'bytes':glb.stat().st_size,'sha256':sha256(glb),'geometry':'Inferred tabletop replacement plus previous planar wall completion','texture':'Original calibrated photographs reprojected onto combined mesh'},indent=2))
