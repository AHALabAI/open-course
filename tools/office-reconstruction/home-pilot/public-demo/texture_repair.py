"""Reproject source photographs onto conservatively repaired mesh; original experiment untouched."""
from pathlib import Path
import sys,json,shutil
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent))
from pilot import execute,config,sha256
out=ROOT/'repairs/planar-v01';run=ROOT/'runs/office-v01'
cfg=config()
execute([Path(cfg['openmvs_bin'])/'TextureMesh.exe','scene_dense.mvs','-m',out/'scene_patched.ply','-o',out/'scene_textured.mvs','--export-type','glb','--max-texture-size','4096','--max-threads','12','--global-seam-leveling','0','--local-seam-leveling','0'],run/'mvs',out/'logs/texture.log')
glb=out/'office-planar-repaired.glb'
execute([sys.executable,ROOT.parent/'pack_glb.py',out/'scene_textured.glb',glb],out,out/'logs/pack.log')
execute([sys.executable,ROOT.parent.parent/'check_glb.py',glb,'--require-texture'],out,out/'logs/check.log')
shutil.copy2(glb,ROOT/'viewer/assets'/glb.name)
(out/'asset.json').write_text(json.dumps({'file':glb.name,'bytes':glb.stat().st_size,'sha256':sha256(glb),'added_surfaces':'inferred from near-planar hole boundaries; not new measurements','textures':'recomputed from original calibrated images'},indent=2))
print('Repair GLB ready:',glb)
