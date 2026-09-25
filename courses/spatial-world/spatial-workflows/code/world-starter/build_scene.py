"""Independent tutorial scene. Run with Blender's Python, not system Python.
Outputs are confined to this starter. Existing outputs require --overwrite.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'public' / 'assets'
GENERATED = ROOT / 'generated'
targets = [ASSETS / 'room.glb', ASSETS / 'room-render.png', GENERATED / 'room.blend']
if any(p.exists() for p in targets) and '--overwrite' not in sys.argv:
    raise RuntimeError('Outputs already exist. Archive them or explicitly pass -- --overwrite.')
ASSETS.mkdir(parents=True, exist_ok=True)
GENERATED.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.82
    return m

mats = {k: material(k, c) for k,c in {
    'paper':(.77,.79,.69), 'floor':(.64,.49,.29), 'green':(.15,.38,.27),
    'wood':(.32,.18,.08), 'gold':(.9,.52,.12), 'stone':(.32,.4,.35),
    'grass':(.44,.59,.32), 'dark':(.07,.18,.14)}.items()}

def box(name, xyz, size, mat, **extras):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj=bpy.context.object; obj.name=name; obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mats[mat])
    for k,v in extras.items(): obj[k]=v
    return obj

# Blender: Z up, XY ground. glTF export converts to Y up.
box('Ground', (0,0,-.16), (14,12,.3), 'grass', kind='ground')
box('Floor', (0,1.5,.015), (8,5,.05), 'floor', kind='floor')
box('BackWall', (0,4,1.5), (8,.18,3), 'paper')
box('LeftWall', (-4,1.5,1.5), (.18,5,3), 'paper')
box('WindowFrame', (-.8,3.88,1.8), (2.6,.12,1.4), 'dark')
box('WindowGlass', (-.8,3.79,1.8), (2.35,.035,1.16), 'green')
box('Bench', (-2,2.8,.55), (2.6,.7,.16), 'wood')
for x in [-3,-1]: box('BenchLeg', (x,2.8,.27), (.15,.5,.5), 'wood')
box('Table', (1.8,2.4,.85), (1.6,1,.15), 'floor')
for x in [1.2,2.4]:
    for y in [2.1,2.7]:box('TableLeg', (x,y,.42), (.12,.12,.8),'wood')
for i,(x,y) in enumerate([(-2,-2),(2,-2),(3,0)]):
    box(f'Wood_{i}', (x,y,.25), (.45,.45,.5), 'gold', kind='wood', itemId=i)
for i in range(8):
    a=i*math.tau/8
    box('FireStone', (math.cos(a)*.65, -3.7+math.sin(a)*.65,.15), (.3,.3,.25),'stone')
box('Campfire', (0,-3.7,.22), (.7,.6,.3), 'wood', kind='fire')
for x,y in [(5,3),(-5,-2),(-5,4)]:
    box('TreeTrunk',(x,y,.75),(.22,.22,1.5),'wood')
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,1.8))
    bpy.context.object.name='TreeCrown';bpy.context.object.data.materials.append(mats['green'])

world=bpy.data.worlds.new('Daylight');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.75,.81,.76,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.object.light_add(type='AREA',location=(0,-3,10))
bpy.context.object.data.energy=1700;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
bpy.ops.object.light_add(type='SUN',location=(4,-6,8))
bpy.context.object.rotation_euler=(.4,-.4,-.4);bpy.context.object.data.energy=1.5
bpy.ops.object.camera_add(location=(13,-17,14))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.7))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=19;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(targets[1])
bpy.ops.wm.save_as_mainfile(filepath=str(targets[2]))
bpy.ops.export_scene.gltf(filepath=str(targets[0]),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False)
bpy.ops.render.render(write_still=True)
print('TUTORIAL_READY',*[str(p) for p in targets],flush=True)
