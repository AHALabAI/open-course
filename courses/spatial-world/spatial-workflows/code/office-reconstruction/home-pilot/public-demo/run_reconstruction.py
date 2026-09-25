"""Recompute dense mesh from public images and provided calibration; keep stage logs."""
from pathlib import Path
import sys, json, time
ROOT = Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent))
from pilot import execute, config, sha256
run=ROOT/'runs/office-v01'
cfg=config()
start=time.time()
execute([cfg['colmap'],'model_analyzer','--path',run/'dense/sparse'],run,run/'logs/provided-model-analysis.log')
stages=[
 ('InterfaceCOLMAP',['-i','../dense','-o','scene.mvs','--image-folder','../dense/images']),
 ('DensifyPointCloud',['scene.mvs','--resolution-level','1','--max-threads','12']),
 ('ReconstructMesh',['scene_dense.mvs','-p','scene_dense.ply','--decimate','0.25','--max-threads','12']),
 ('TextureMesh',['scene_dense.mvs','-m','scene_dense_mesh.ply','-o','scene_textured.mvs','--export-type','glb','--max-texture-size','4096','--max-threads','12','--global-seam-leveling','0','--local-seam-leveling','0'])]
for name,args in stages:
 execute([Path(cfg['openmvs_bin'])/(name+'.exe'),*args],run/'mvs',run/'logs'/(name+'.log'))
glb=run/'delivery/office.glb'
execute([sys.executable,ROOT.parent/'pack_glb.py',run/'mvs/scene_textured.glb',glb],run,run/'logs/pack.log')
execute([sys.executable,ROOT.parent.parent/'check_glb.py',glb,'--require-texture'],run,run/'logs/check.log')
(run/'result.json').write_text(json.dumps({'status':'dense_mesh_and_embedded_glb_created','elapsed_seconds':time.time()-start,'sha256':sha256(glb),'bytes':glb.stat().st_size,'images':261,'camera_poses':'provided by dataset, not estimated in this run','geometry':'dense reconstruction computed locally','scale':'not independently measured','collision_ready':False},indent=2))
print('GLB ready:',glb,flush=True)
