"""Inspect new_horse_1.glb: mesh size, skeleton, animation, materials.
Usage: blender --background --python inspect_horse.py
"""

import bpy
import json
import os

GLB_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/new_horse_1.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    out = {"objects": []}
    for obj in bpy.context.scene.objects:
        info = {"name": obj.name, "type": obj.type}
        if obj.type == "MESH":
            mesh = obj.data
            mesh.calc_loop_triangles()
            info["vertexCount"] = len(mesh.vertices)
            info["triCount"] = len(mesh.loop_triangles)
            info["vertexGroupCount"] = len(obj.vertex_groups)
            info["vertexGroups"] = [vg.name for vg in obj.vertex_groups]
            info["materialCount"] = len(obj.data.materials)
            info["hasUV"] = len(mesh.uv_layers) > 0
            info["hasArmatureModifier"] = any(m.type == "ARMATURE" for m in obj.modifiers)
        if obj.type == "ARMATURE":
            info["boneCount"] = len(obj.data.bones)
            info["boneNames"] = [b.name for b in obj.data.bones]
            info["boneParents"] = [(b.name, b.parent.name if b.parent else None) for b in obj.data.bones]
        out["objects"].append(info)

    print("=== HORSE SUMMARY ===", flush=True)
    print(json.dumps(out, indent=2), flush=True)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
