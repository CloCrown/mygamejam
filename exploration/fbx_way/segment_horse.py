"""Segment new_horse.glb into rig parts (body, head/neck, 4 legs, tail) by
grouping the mesh's disconnected islands by spatial position, so game.js
can animate each part like the old cube rig (rotate legs for a gait cycle)
instead of rendering one rigid static blob.

Outputs one compact JSON per part: { name, positions, indices, pivot }
where pivot is the joint origin (hip/shoulder/neck base) each part should
rotate around, expressed relative to the part's own local vertices (i.e.
vertices are stored already offset so pivot = [0,0,0] in local space, and
the part's world placement = pivot position in the whole-horse frame).

Usage: blender --background --python segment_horse.py
"""

import bpy
import bmesh
import json

GLB_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/new_horse.glb"
OUT_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/horse_parts.json"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def find_islands(bm):
    visited = set()
    islands = []
    for v in bm.verts:
        if v.index in visited:
            continue
        stack = [v]
        island = []
        while stack:
            cur = stack.pop()
            if cur.index in visited:
                continue
            visited.add(cur.index)
            island.append(cur)
            for e in cur.link_edges:
                other = e.other_vert(cur)
                if other.index not in visited:
                    stack.append(other)
        islands.append(island)
    return islands


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    mesh_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            mesh_obj = obj
            break

    mat = mesh_obj.matrix_world
    mesh = mesh_obj.data

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    islands = find_islands(bm)
    print("island count:", len(islands), flush=True)

    # Same centering as extract_horse.py: center X/Z (width/depth), sit on
    # the ground (min Y = 0). Without this, classification below saw every
    # island on one side of X=0 only (all islands' raw world.x < 0), which
    # dropped the right-side legs entirely from the leg-left/-right split.
    all_world = [mat @ v.co for v in bm.verts]
    cx = (min(p.x for p in all_world) + max(p.x for p in all_world)) / 2
    cz = (min(p.y for p in all_world) + max(p.y for p in all_world)) / 2  # blender Y = game Z
    minY = min(p.z for p in all_world)  # blender Z = game Y (up)

    def to_game_space(co):
        world = mat @ co
        return (world.x - cx, world.z - minY, world.y - cz)  # matches extract_horse.py's remap

    island_info = []
    for verts in islands:
        pts = [to_game_space(v.co) for v in verts]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        zs = [p[2] for p in pts]
        centroid = (sum(xs) / len(xs), sum(ys) / len(ys), sum(zs) / len(zs))
        island_info.append({
            "verts": verts,
            "centroid": centroid,
            "miny": min(ys),
            "maxy": max(ys),
        })

    # Determine overall extents to classify islands by fraction of body length/height.
    # Named distinctly from the outer minY/cx/cz (used by to_game_space) —
    # reusing those names here previously shadowed them, and since
    # to_game_space is a closure that looks up minY by name (not by value
    # at definition time), every later call to it (e.g. when computing leg
    # pivots below) silently used this centroid-based minY instead of the
    # real per-vertex minimum, sinking every part far below the ground.
    all_y = [i["centroid"][1] for i in island_info]
    all_z = [i["centroid"][2] for i in island_info]
    minCentroidY, maxCentroidY = min(all_y), max(all_y)
    minCentroidZ, maxCentroidZ = min(all_z), max(all_z)

    def classify(info):
        cx, cy, cz = info["centroid"]
        yFrac = (cy - minCentroidY) / (maxCentroidY - minCentroidY + 1e-9)  # 0=ground,1=top
        zFrac = (cz - minCentroidZ) / (maxCentroidZ - minCentroidZ + 1e-9)  # 0=back(tail),1=front(head)

        # Legs: low to the ground.
        if yFrac < 0.45:
            if zFrac > 0.5:
                return "leg-fr" if cx > 0 else "leg-fl"
            else:
                return "leg-br" if cx > 0 else "leg-bl"
        # Head/neck: high and toward the front.
        if zFrac > 0.65:
            return "head"
        # Tail: toward the back, not a leg.
        if zFrac < 0.25:
            return "tail"
        return "body"

    groups = {}
    for info in island_info:
        part = classify(info)
        groups.setdefault(part, []).append(info)

    for part, infos in groups.items():
        print(part, ":", len(infos), "islands,", sum(len(i["verts"]) for i in infos), "verts", flush=True)

    # Build a face lookup: for each island's verts (by original index), find
    # faces fully inside that island, using the bmesh face list.
    vert_to_island = {}
    for idx, info in enumerate(island_info):
        for v in info["verts"]:
            vert_to_island[v.index] = idx

    island_faces = {i: [] for i in range(len(island_info))}
    for f in bm.faces:
        vi = [v.index for v in f.verts]
        isl = vert_to_island[vi[0]]
        island_faces[isl].append(vi)

    # Now build per-part mesh data: gather all islands assigned to a part,
    # remap to local vertex indices, compute pivot (top-center of the
    # island group, i.e. where it would attach to the body), and store
    # positions relative to that pivot.
    parts_out = {}
    for part, infos in groups.items():
        local_positions = []
        local_index_map = {}  # original vert index -> local index
        indices = []

        # Pivot: for legs, the top (max Y) point of the group, at its XZ
        # centroid — this is where the hip/shoulder joint would be.
        all_pts = []
        for info in infos:
            for v in info["verts"]:
                all_pts.append(to_game_space(v.co))

        if part.startswith("leg-"):
            topY = max(p[1] for p in all_pts)
            topPts = [p for p in all_pts if p[1] > topY - 0.05]
            pivot = (
                sum(p[0] for p in topPts) / len(topPts),
                topY,
                sum(p[2] for p in topPts) / len(topPts),
            )
        elif part == "head":
            # Pivot at the base of the neck (lowest+backmost point of the group).
            minZ_local = min(p[2] for p in all_pts)
            basePts = [p for p in all_pts if p[2] < minZ_local + 0.05]
            pivot = (
                sum(p[0] for p in basePts) / len(basePts),
                sum(p[1] for p in basePts) / len(basePts),
                minZ_local,
            )
        elif part == "tail":
            maxZ_local = max(p[2] for p in all_pts)
            basePts = [p for p in all_pts if p[2] > maxZ_local - 0.05]
            pivot = (
                sum(p[0] for p in basePts) / len(basePts),
                sum(p[1] for p in basePts) / len(basePts),
                maxZ_local,
            )
        else:  # body
            pivot = (0, 0, 0)

        for info in infos:
            for v in info["verts"]:
                if v.index not in local_index_map:
                    local_index_map[v.index] = len(local_positions)
                    p = to_game_space(v.co)
                    local_positions.append([
                        round(p[0] - pivot[0], 4),
                        round(p[1] - pivot[1], 4),
                        round(p[2] - pivot[2], 4),
                    ])

        for info in infos:
            isl_idx = island_info.index(info)
            for face_vi in island_faces[isl_idx]:
                if len(face_vi) == 3:
                    tri = face_vi
                elif len(face_vi) == 4:
                    tri_list = [[face_vi[0], face_vi[1], face_vi[2]], [face_vi[0], face_vi[2], face_vi[3]]]
                    for tri in tri_list:
                        indices.extend([local_index_map[i] for i in tri])
                    continue
                else:
                    continue
                indices.extend([local_index_map[i] for i in tri])

        parts_out[part] = {
            "positions": local_positions,
            "indices": indices,
            "pivot": list(pivot),
        }

    with open(OUT_PATH, "w") as f:
        json.dump(parts_out, f)

    print("=== PARTS ===", flush=True)
    for part, data in parts_out.items():
        print(part, "verts:", len(data["positions"]), "tris:", len(data["indices"]) // 3, "pivot:", data["pivot"], flush=True)
    print("written to:", OUT_PATH, flush=True)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
