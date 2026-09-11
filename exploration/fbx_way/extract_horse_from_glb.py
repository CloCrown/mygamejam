"""Same extraction as extract_horse_rig_skinned.py, but reading horse.glb
instead of new_horse.glb — kept as a separate script (exploration phase) so
the working new_horse.glb pipeline stays untouched if horse.glb doesn't work
out.

Usage: blender --background --python extract_horse_from_glb.py
"""

import bpy
import json

GLB_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/horse.glb"
OUT_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/horse_from_glb_rig_skinned.json"

MAX_INFLUENCES = 2


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def to_game_space_vec(world_co, cx, cz, minY):
    return (world_co.x - cx, world_co.z - minY, world_co.y - cz)


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    mesh_obj = None
    armature_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and len(obj.vertex_groups) > 0:
            mesh_obj = obj
        if obj.type == "ARMATURE":
            armature_obj = obj

    if mesh_obj is None or armature_obj is None:
        print(">>> FATAL ERROR: mesh_obj or armature_obj not found", flush=True)
        print("scene objects:", [(o.name, o.type) for o in bpy.context.scene.objects], flush=True)
        return

    mesh = mesh_obj.data
    mesh.calc_loop_triangles()
    mat = mesh_obj.matrix_world

    all_world = [mat @ v.co for v in mesh.vertices]
    cx = (min(p.x for p in all_world) + max(p.x for p in all_world)) / 2
    cz = (min(p.y for p in all_world) + max(p.y for p in all_world)) / 2
    minY = min(p.z for p in all_world)

    def to_game_space(co):
        world = mat @ co
        return to_game_space_vec(world, cx, cz, minY)

    bones_out = {}
    for bone in armature_obj.data.bones:
        head_world = armature_obj.matrix_world @ bone.head_local
        tail_world = armature_obj.matrix_world @ bone.tail_local
        bones_out[bone.name] = {
            "parent": bone.parent.name if bone.parent else None,
            "head": [round(x, 3) for x in to_game_space_vec(head_world, cx, cz, minY)],
            "tail": [round(x, 3) for x in to_game_space_vec(tail_world, cx, cz, minY)],
        }

    uv_layer = mesh.uv_layers.active.data if mesh.uv_layers.active else None
    vertex_uv = [None] * len(mesh.vertices)
    if uv_layer:
        for loop in mesh.loops:
            vi = loop.vertex_index
            if vertex_uv[vi] is None:
                uv = uv_layer[loop.index].uv
                vertex_uv[vi] = [round(uv.x, 3), round(1 - uv.y, 3)]

    vertices_out = []
    for i, v in enumerate(mesh.vertices):
        groups = sorted(v.groups, key=lambda g: -g.weight)[:MAX_INFLUENCES]
        total = sum(g.weight for g in groups)
        influences = []
        if total > 1e-8:
            for g in groups:
                bone_name = mesh_obj.vertex_groups[g.group].name
                influences.append([bone_name, round(g.weight / total, 3)])
        p = to_game_space(v.co)
        vertices_out.append({
            "position": [round(x, 3) for x in p],
            "uv": vertex_uv[i] or [0, 0],
            "influences": influences,
        })

    indices = []
    for tri in mesh.loop_triangles:
        ia, ib, ic = tri.vertices[0], tri.vertices[2], tri.vertices[1]
        if not vertices_out[ia]["influences"] and not vertices_out[ib]["influences"] and not vertices_out[ic]["influences"]:
            continue
        indices.extend([ia, ib, ic])

    out = {
        "bones": bones_out,
        "vertices": vertices_out,
        "indices": indices,
    }
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)

    print("=== SKINNED RIG EXTRACTED (horse.glb) ===", flush=True)
    print("bones:", len(bones_out), flush=True)
    print("vertices:", len(vertices_out), flush=True)
    print("triangles:", len(indices) // 3, flush=True)
    no_influence = sum(1 for v in vertices_out if not v["influences"])
    print("vertices with no influence:", no_influence, flush=True)
    print("written to:", OUT_PATH, flush=True)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
