from pathlib import Path
root=Path(__file__).resolve().parent
s=(root/'viewer/article-photo-compare.html').read_text(encoding='utf-8')
s=s.replace("original:'office.glb',final:'office-room-final.glb',overlay:'room-repair-overlay-final.glb'","original:'office.glb',previous:'office-room-final.glb',final:'office-envelope-final.glb',overlay:'envelope-overlay.glb'")
s=s.replace("models.overlay.getObjectByName('inferred_tabletop').visible=false;","models.overlay.getObjectByName('inferred_tabletop').visible=false;models.overlay.getObjectByName('inferred_walls').visible=false;")
s=s.replace('window.comparisonReady=true;',"window.renderInspection=(variant,pos,target,fov=75)=>{renderer.setSize(1280,800);camera.position.fromArray(pos);camera.up.set(0,1,0);camera.lookAt(new THREE.Vector3(...target));camera.aspect=1280/800;camera.fov=fov;camera.near=.01;camera.far=1000;camera.updateProjectionMatrix();for(const [key,m] of Object.entries(models))m.visible=key===variant;renderer.render(scene,camera);};window.comparisonReady=true;")
(root/'viewer/envelope-review.html').write_text(s,encoding='utf-8')
