"""Extract new_horse.glb (mesh + armature, from Blender's Automatic Weights
skinning) into a compact rigid-skin format for the game: every vertex is
assigned to exactly one bone (its strongest influence, weight blending
dropped), so there's no per-vertex weight to store — just a bone index.
This replaces the earlier island-proximity-guessing segmentation with the
skinning Blender itself computed from the actual armature.

Usage: blender --background --python extract_horse_rig.py
"""

import bpy
import json

GLB_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/new_horse_1.glb"
OUT_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/horse_rig.json"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


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

    mesh = mesh_obj.data
    mesh.calc_loop_triangles()
    mat = mesh_obj.matrix_world

    # Same axis remap as extract_horse.py: Blender Z-up (X width, Y depth,
    # Z height) -> game Y-up (X width, Y height, Z depth). This swap is a
    # reflection (flips chirality), so triangle winding must be reversed
    # to keep CCW-front-facing for gl.CULL_FACE.
    all_world = [mat @ v.co for v in mesh.vertices]
    cx = (min(p.x for p in all_world) + max(p.x for p in all_world)) / 2
    cz = (min(p.y for p in all_world) + max(p.y for p in all_world)) / 2
    minY = min(p.z for p in all_world)

    def to_game_space(co):
        world = mat @ co
        return (world.x - cx, world.z - minY, world.y - cz)

    # Bone rest-pose head/tail positions, in game space, for building the
    # rig hierarchy (pivot = head of the bone, where it attaches to its
    # parent) and for computing each bone's local-space vertex offsets.
    bones_out = {}
    for bone in armature_obj.data.bones:
        head_world = armature_obj.matrix_world @ bone.head_local
        tail_world = armature_obj.matrix_world @ bone.tail_local
        bones_out[bone.name] = {
            "parent": bone.parent.name if bone.parent else None,
            "head": list(to_game_space_vec(head_world, cx, cz, minY)),
            "tail": list(to_game_space_vec(tail_world, cx, cz, minY)),
        }

    # Assign each vertex to its single strongest-weight bone (rigid skin).
    vertex_bone = []
    for v in mesh.vertices:
        if len(v.groups) == 0:
            vertex_bone.append(None)
            continue
        best = max(v.groups, key=lambda g: g.weight)
        bone_name = mesh_obj.vertex_groups[best.group].name
        vertex_bone.append(bone_name)

    # Reversed vertex order (a, c, b) to compensate the axis-swap reflection.
    indices_by_bone = {}
    for tri in mesh.loop_triangles:
        ia, ib, ic = tri.vertices[0], tri.vertices[2], tri.vertices[1]
        # A triangle is assigned to the bone of its first vertex; with
        # per-vertex rigid skinning a triangle can span two bones at a
        # joint seam, but each part still reads as attached to the right
        # limb since most triangles are fully inside one bone's region.
        bone_name = vertex_bone[tri.vertices[0]]
        if bone_name is None:
            continue
        indices_by_bone.setdefault(bone_name, []).append((ia, ib, ic))

    parts_out = {}
    for bone_name, tris in indices_by_bone.items():
        pivot = bones_out[bone_name]["head"]
        local_positions = []
        local_index_map = {}
        indices = []
        for tri in tris:
            local_tri = []
            for vi in tri:
                if vi not in local_index_map:
                    local_index_map[vi] = len(local_positions)
                    p = to_game_space(mesh.vertices[vi].co)
                    local_positions.append([
                        round(p[0] - pivot[0], 4),
                        round(p[1] - pivot[1], 4),
                        round(p[2] - pivot[2], 4),
                    ])
                local_tri.append(local_index_map[vi])
            indices.extend(local_tri)
        parts_out[bone_name] = {
            "positions": local_positions,
            "indices": indices,
            "pivot": [round(x, 4) for x in pivot],
            "parent": bones_out[bone_name]["parent"],
        }

    out = {"parts": parts_out}
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)

    print("=== RIG EXTRACTED ===", flush=True)
    total_v = 0
    total_t = 0
    for name, data in parts_out.items():
        nv = len(data["positions"])
        nt = len(data["indices"]) // 3
        total_v += nv
        total_t += nt
        print(name, "verts:", nv, "tris:", nt, "pivot:", data["pivot"], "parent:", data["parent"], flush=True)
    print("TOTAL verts:", total_v, "tris:", total_t, flush=True)
    print("written to:", OUT_PATH, flush=True)


def to_game_space_vec(world_co, cx, cz, minY):
    return (world_co.x - cx, world_co.z - minY, world_co.y - cz)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
