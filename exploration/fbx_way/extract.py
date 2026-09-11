"""Run headless with Blender's bundled Python to extract a compact JSON dump
from SK_Player.fbx (mesh + skeleton) and walking.fbx (animation), for a
quick "how much does this weigh" test before deciding whether a rigged/
animated character can fit a js13k budget at all.

Usage:
  blender --background --python extract.py
"""

import bpy
import json
import os
import math

HERE = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes) + list(bpy.data.armatures) + list(bpy.data.actions):
        try:
            block.user_clear()
        except Exception:
            pass


def round3(x):
    return round(x, 3)


def extract_mesh_and_skeleton(fbx_path):
    clear_scene()
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    mesh_obj = None
    armature_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and mesh_obj is None:
            mesh_obj = obj
        if obj.type == "ARMATURE" and armature_obj is None:
            armature_obj = obj

    result = {"vertexCount": 0, "triCount": 0, "boneCount": 0}

    if mesh_obj:
        mesh = mesh_obj.data
        mesh.calc_loop_triangles()
        result["vertexCount"] = len(mesh.vertices)
        result["triCount"] = len(mesh.loop_triangles)
        # How many bone influences per vertex (for skinning weight cost).
        result["hasVertexGroups"] = len(mesh_obj.vertex_groups) > 0
        result["vertexGroupCount"] = len(mesh_obj.vertex_groups)

    if armature_obj:
        result["boneCount"] = len(armature_obj.data.bones)
        result["boneNames"] = [b.name for b in armature_obj.data.bones]

    return result


def extract_animation(fbx_path):
    clear_scene()
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    armature_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE":
            armature_obj = obj
            break

    result = {"boneCount": 0, "frameCount": 0, "fps": bpy.context.scene.render.fps}

    if armature_obj and armature_obj.animation_data and armature_obj.animation_data.action:
        action = armature_obj.animation_data.action
        frame_start, frame_end = action.frame_range
        result["frameStart"] = frame_start
        result["frameEnd"] = frame_end
        result["frameCount"] = int(frame_end - frame_start) + 1
        result["boneCount"] = len(armature_obj.pose.bones)
        fcurve_count = 0
        if hasattr(action, "fcurves"):
            fcurve_count = len(action.fcurves)
        elif hasattr(action, "layers"):
            for layer in action.layers:
                for strip in layer.strips:
                    for cbag in strip.channelbags:
                        fcurve_count += len(cbag.fcurves)
        result["fcurveCount"] = fcurve_count

    return result


def main():
    print(">>> main start", flush=True)
    player_fbx = os.path.join(HERE, "SK_Player.fbx")
    walking_fbx = os.path.join(HERE, "walking.fbx")

    out = {}
    if os.path.exists(player_fbx):
        print(">>> extracting player...", flush=True)
        out["player"] = extract_mesh_and_skeleton(player_fbx)
    if os.path.exists(walking_fbx):
        print(">>> extracting walking...", flush=True)
        out["walking"] = extract_animation(walking_fbx)

    out_path = os.path.join(HERE, "extract_summary.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)

    print("=== EXTRACT SUMMARY ===", flush=True)
    print(json.dumps(out, indent=2), flush=True)
    print("Written to:", out_path, flush=True)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
