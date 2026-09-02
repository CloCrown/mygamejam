import bpy
import math
from mathutils import Vector

target = bpy.data.objects["Unicorn"]
target_center = Vector((0, 1.8, -1.5))

bpy.ops.object.camera_add(location=(-2, 2.5, -3.5))
cam = bpy.context.active_object
bpy.context.scene.camera = cam

direction = target_center - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.light_add(type="SUN", location=(4, 6, -4))
key_light = bpy.context.active_object
key_light.data.energy = 4
key_light.rotation_euler = (math.radians(55), 0, math.radians(35))

bpy.ops.object.light_add(type="SUN", location=(-4, 3, 4))
fill_light = bpy.context.active_object
fill_light.data.energy = 1.5
fill_light.rotation_euler = (math.radians(70), 0, math.radians(-120))

world = bpy.context.scene.world
if world is None:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.35, 0.35, 0.4, 1)
    bg.inputs[1].default_value = 1.0

scene = bpy.context.scene
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.filepath = "C:/Users/Boris/Documents/Clocrown/myGameJam/blender/unicorn_render.png"
scene.render.engine = "BLENDER_EEVEE"

bpy.ops.render.render(write_still=True)
print("Rendered.")
