"""Extract a flat 2D horse rig (bones + skin weights) from a Blender-authored
.glb into JSON, for the procedural 2D platformer character (see CLAUDE.md,
"Origine des bones en 2D"). Adapted from explore-3's
extract_horse_rig_skinned.py: same bones+skinning extraction, but the model
is a flat side-view mesh (built from an SVG silhouette, converted to mesh,
armature added, Automatic Weights applied) instead of a real 3D unicorn, so
only 2 axes are kept per point instead of 3 (the depth axis is dropped).

Usage: blender --background --python extract_horse_rig_2d.py
"""

import bpy
import json

GLB_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/glb_models/horse_2d.glb"
OUT_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/horse_rig_2d.json"

MAX_INFLUENCES = 2
# Triangles with an area below this (in the mesh's own units, ~0.1 unit
# tall) are dropped: a post-Decimate mesh can keep degenerate/near-flat
# triangles that cover no visible surface but still get iterated at
# render time, and previously showed up as holes in the horse silhouette
# (see CLAUDE.md, mesh troue after Decimate). Filtering them here doesn't
# restore any missing surface - it only skips triangles that already
# painted nothing - so a torn silhouette still needs a Blender-side fix
# (undo the Decimate, or redo it with a gentler ratio and confirm Solid
# shading shows no holes) before re-running this script.
MIN_TRIANGLE_AREA = 1e-7


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def to_2d(world_co, cx, minY):
    # Flat side-view mesh: X = horizontal (along the horse), Y = vertical
    # (up); the mesh was authored flat in the XY plane (Z sits at ~1e-8,
    # confirmed by inspecting the raw .glb), so Z is the near-zero depth
    # axis dropped here rather than combined into game space like
    # explore-3's 3-axis version did.
    return (round(world_co.x - cx, 3), round(world_co.y - minY, 3))


def triangle_area(pa, pb, pc):
    return abs((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1])) / 2


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
        raise RuntimeError("Expected one skinned MESH and one ARMATURE in %s" % GLB_PATH)

    mesh = mesh_obj.data
    mesh.calc_loop_triangles()
    mat = mesh_obj.matrix_world

    all_world = [mat @ v.co for v in mesh.vertices]
    cx = (min(p.x for p in all_world) + max(p.x for p in all_world)) / 2
    minY = min(p.z for p in all_world)

    def vert_to_2d(co):
        return to_2d(mat @ co, cx, minY)

    bones_out = {}
    for bone in armature_obj.data.bones:
        head_world = armature_obj.matrix_world @ bone.head_local
        tail_world = armature_obj.matrix_world @ bone.tail_local
        bones_out[bone.name] = {
            "parent": bone.parent.name if bone.parent else None,
            "head": list(to_2d(head_world, cx, minY)),
            "tail": list(to_2d(tail_world, cx, minY)),
        }

    vertices_out = []
    for i, v in enumerate(mesh.vertices):
        groups = sorted(v.groups, key=lambda g: -g.weight)[:MAX_INFLUENCES]
        total = sum(g.weight for g in groups)
        influences = []
        if total > 1e-8:
            for g in groups:
                bone_name = mesh_obj.vertex_groups[g.group].name
                influences.append([bone_name, round(g.weight / total, 3)])
        p = vert_to_2d(v.co)
        vertices_out.append({
            "position": list(p),
            "influences": influences,
        })

    indices = []
    dropped_degenerate = 0
    for tri in mesh.loop_triangles:
        ia, ib, ic = tri.vertices[0], tri.vertices[1], tri.vertices[2]
        if not vertices_out[ia]["influences"] and not vertices_out[ib]["influences"] and not vertices_out[ic]["influences"]:
            continue
        area = triangle_area(vertices_out[ia]["position"], vertices_out[ib]["position"], vertices_out[ic]["position"])
        if area < MIN_TRIANGLE_AREA:
            dropped_degenerate += 1
            continue
        indices.extend([ia, ib, ic])

    out = {
        "bones": bones_out,
        "vertices": vertices_out,
        "indices": indices,
    }
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)

    print("=== 2D RIG EXTRACTED ===", flush=True)
    print("bones:", len(bones_out), flush=True)
    print("vertices:", len(vertices_out), flush=True)
    print("triangles:", len(indices) // 3, flush=True)
    print("degenerate triangles dropped:", dropped_degenerate, flush=True)
    no_influence = sum(1 for v in vertices_out if not v["influences"])
    print("vertices with no influence:", no_influence, flush=True)
    print("written to:", OUT_PATH, flush=True)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
