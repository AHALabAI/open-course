"""Create the Explorer Hall from primitives: Blender --background --python build_scene.py.

Coordinates passed to box() are game x/y/z (Y up); Blender uses Z up.
The glTF exporter converts the axes. No external models or textures are read.
"""
from pathlib import Path
import sys
import json
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'public/assets'
GENERATED = ROOT / 'generated'
HEIGHT = 2.92
targets = [ASSETS/'explorer-hall.glb', ASSETS/'navigation.json',
           ASSETS/'explorer-hall.png', GENERATED/'explorer-hall.blend']
if '--overwrite' not in sys.argv and any(p.exists() for p in targets):
    raise FileExistsError('Outputs exist. Archive them or pass --overwrite to rebuild.')
ASSETS.mkdir(parents=True, exist_ok=True)
GENERATED.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.preferences.filepaths.save_version = 0

def material(name, rgb, metallic=0):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.7
    bs.inputs['Metallic'].default_value=metallic
    return m

chalk=material('Warm limestone',(.72,.69,.57))
wood=material('Honey timber',(.43,.25,.12))
green=material('Pine green',(.055,.19,.14))
teal=material('Patinated metal',(.09,.32,.32),.2)
gold=material('Brass details',(.71,.43,.12),.4)
paper=material('Cream',(.9,.85,.68))
leaf=material('Sage foliage',(.24,.39,.18))
soil=material('Earth',(.25,.21,.14))
water=material('Pond blue',(.13,.41,.46),.3)
solar=material('Solar blue',(.04,.1,.19),.35)
stone=material('Courtyard paving',(.43,.48,.4))
floors=[]
nav={'source':'AHALab Explorer Hall — procedural original','floorHeight':HEIGHT,'floors':[],'objects':[]}
for f in range(4):
    g=bpy.data.objects.new(f'Floor_{f+1}',None)
    bpy.context.collection.objects.link(g)
    g['floor']=f
    floors.append(g)
    nav['floors'].append({'floor':f,'y':f*HEIGHT,'walkable':[],'walls':[]})

def box(name, size, pos, mat=chalk, floor=None, collision=False):
    x,y,z=pos; w,h,d=size
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
    obj=bpy.context.object;obj.name=name;obj.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    if floor is not None:
        obj.parent=floors[floor];obj['floor']=floor
    if collision and floor is not None:
        nav['floors'][floor]['walls'].append([x-w/2,z-d/2,x+w/2,z+d/2])
    return obj

def slab(f, bounds):
    x0,z0,x1,z1=bounds
    box('Walkable_slab',(x1-x0,.2,z1-z0),((x0+x1)/2,f*HEIGHT-.1,(z0+z1)/2),chalk,f)
    nav['floors'][f]['walkable'] += [[[x0,z0],[x1,z0],[x1,z1]],[[x0,z0],[x1,z1],[x0,z1]]]

def rail(f,x,z,w,d):
    y=f*HEIGHT
    box('Guardrail',(w,1,d),(x,y+.5,z),teal,f,True)
    box('Timber_handrail',(w+.04,.09,d+.04),(x,y+1.04,z),wood,f)

def plant(x,z,y=0,f=0):
    box('Planter',(.7,.48,.7),(x,y+.24,z),wood,f,True)
    box('Plant_stem',(.09,.7,.09),(x,y+.8,z),wood,f)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.62,location=(x,-z,y+1.15))
    o=bpy.context.object;o.name='Foliage';o.data.materials.append(leaf);o.parent=floors[f];o['floor']=f

def table(f,x,z):
    y=f*HEIGHT
    box('Worktable',(2.3,.12,1.2),(x,y+.95,z),wood,f,True)
    for dx in [-.92,.92]:
        for dz in [-.43,.43]:box('Table_leg',(.1,.9,.1),(x+dx,y+.45,z+dz),green,f)
    box('Sketchbook',(.5,.035,.38),(x-.5,y+1.04,z),paper,f)
    box('Prototype_base',(.48,.1,.4),(x+.5,y+1.06,z),teal,f)
    for dx in [-.16,.16]:box('Prototype_wheel',(.08,.18,.18),(x+.5+dx,y+1.11,z+.22),green,f)

# The site is an invented four-level civic workshop around an open atrium.
box('Island_soil',(46,1.2,40),(1,-.85,4),soil)
slab(0,[-11,-7,16,11])
# Pond is a non-walkable inset within the garden apron.
nav['floors'][0]['walls'].append([10.6,-.5,13.7,1.9])
box('Pond_rim',(3.5,.16,2.8),(12,.03,.7),stone,0)
box('Pond_water',(3.1,.04,2.4),(12,.13,.7),water,0)
for x in [-10,-6,-2,2,6,10,14]:
    box('Paving_joint',(.025,.01,4),(x,.008,8.5),wood,0)
for f in range(4):
    y=f*HEIGHT
    if f:
        # Broad side wings and crossways frame the open light well.
        for r in [[-10,-6,-2,6],[2,-6,10,6],[-2,-6,2,-2],[-2,2,2,6]]:slab(f,r)
        for x in [-2,2]:rail(f,x,0,.1,4)
        for z in [-2,2]:rail(f,0,z,4,.1)
    # Four front door bays stay open. Side/back walls have window gaps.
    if f<3:
        for x in [-10,10]:
            for z in [-5.8,-2,2,5.8]:
                box('Structural_column',(.32,2.72,.32),(x,y+1.36,z),wood,f,True)
            box('Side_spandrel',(.22,.6,12),(x,y+.3,0),chalk,f,True)
            box('Side_lintel',(.25,.3,12),(x,y+2.55,0),green,f)
        for x in [-8,-4,0,4,8]:
            box('Back_sill',(3.7,.65,.22),(x,y+.325,-6),chalk,f,True)
            box('Window_mullion',(.12,1.8,.14),(x,y+1.5,-6),wood,f)
        box('Back_lintel',(20,.25,.3),(0,y+2.58,-6),green,f)
        for x in [-10,-6,-2,2,6,10]:
            box('Front_pier',(.28,2.72,.28),(x,y+1.36,6),wood,f,True)
        box('Front_beam',(20,.28,.32),(0,y+2.58,6),green,f)
    if f:
        rail(f,0,6,19.6,.14)
    if f==3:
        for x in [-10,10]:rail(f,x,0,.12,12)
        rail(f,0,-6,20,.12)
    # Stairwell uses an explicit landing action in the game, with visual treads.
    if f<3:
        for i in range(16):
            box('Stair_tread',(1.35,.13,.24),(5.4,y+(i+1)*HEIGHT/16,-.5-i*.23),wood,f)
        nav['floors'][f]['walls'].append([4.72,-4.15,6.08,-.35])
        box('Landing_post',(.12,1.2,.12),(4.25,y+.6,-1),teal,f)
        box('Landing_plaque',(.35,.25,.08),(4.25,y+1.3,-1),gold,f)

for f in [0,1,2]:
    table(f,-6,-3)
    table(f,7,3.7)
    plant(-8.7,4.5,f*HEIGHT,f)
    # Shelves with individually colored volumes; no textures are imported.
    box('Bookcase',(3,.12,.5),(-5,f*HEIGHT+.14,-5.4),wood,f,True)
    for h in [.75,1.45,2.15]:
        box('Shelf',(3,.07,.5),(-5,f*HEIGHT+h,-5.4),wood,f)
        for j in range(12):
            box('Book',(.16,.46+(j%3)*.035,.34),(-6.3+j*.22,f*HEIGHT+h+.27,-5.4),[green,paper,teal,gold][j%4],f)
    for x in [-6.45,-3.55]:box('Shelf_upright',(.1,2.25,.5),(x,f*HEIGHT+1.125,-5.4),wood,f)

# Roof terrace: pergola, observation device, planted beds and solar shade.
for x in [-8,-4]:
    for z in [-4,0]:box('Pergola_post',(.18,2.4,.18),(x,3*HEIGHT+1.2,z),wood,3,True)
for x in [-8,-7.5,-7,-6.5,-6,-5.5,-5,-4.5,-4]:
    box('Pergola_roof',(.15,.12,4.4),(x,3*HEIGHT+2.4,-2),wood,3)
for x in [4,7]:
    box('Solar_stand',(.1,1.5,.1),(x,3*HEIGHT+.75,-4.8),teal,3,True)
    box('Solar_panel',(2.6,.09,1.4),(x,3*HEIGHT+1.55,-4.8),solar,3)
for x in [-8,0,8]:plant(x,4.5,3*HEIGHT,3)
box('Telescope_pedestal',(.35,1.1,.35),(8,3*HEIGHT+.55,-2),gold,3,True)
scope=box('Telescope',(.32,.35,1.4),(8,3*HEIGHT+1.35,-2),teal,3)
scope.rotation_euler[0]=.3
# A covered garden pavilion, deliberately unlike any real premises.
for x in [11,15]:
    for z in [-5.5,-2.5]:box('Pavilion_post',(.2,2.6,.2),(x,1.3,z),wood,0,True)
box('Pavilion_roof',(4.6,.18,3.6),(13,2.7,-4),green,0)
for z in [-5.7,-5,-4.3,-3.6,-2.9,-2.3]:box('Roof_batten',(4.8,.12,.12),(13,2.84,z),wood,0)

(ASSETS/'navigation.json').write_text(json.dumps(nav,ensure_ascii=False,indent=2),encoding='utf-8')
scene=bpy.context.scene
scene.world=bpy.data.worlds.new('Daylight')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.73,.69,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(0,-12,25))
bpy.context.object.data.energy=3300;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=20
bpy.ops.object.light_add(type='SUN',location=(10,-8,15))
bpy.context.object.rotation_euler=(.4,-.3,-.5);bpy.context.object.data.energy=2
bpy.ops.object.camera_add(location=(36,-46,31))
camera=bpy.context.object;camera.rotation_euler=(Vector((1,-2,4))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=48;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1440;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ASSETS/'explorer-hall.png')
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(GENERATED/'explorer-hall.blend'))
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'explorer-hall.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False)
bpy.ops.render.render(write_still=True)
print('Explorer Hall created:',len([o for o in scene.objects if o.type=='MESH']),'meshes')
