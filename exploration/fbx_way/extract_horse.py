"""Extract new_horse.glb mesh (positions + triangle indices) to a compact
JSON, for pasting into the WebGL game as a static hand-modeled mesh.

Blender's glTF importer converts the file's Y-up to Blender's native
Z-up on import, so obj.matrix_world gives us Blender-space coordinates
directly: Blender X = width, Blender Y = depth (nose-to-tail), Blender Z
= height (up). We remap those to the game's convention (gl-utils.js/
game.js): X = width, Y = up, Z = forward — i.e. game.x = blender.x,
game.y = blender.z, game.z = blender.y.

Usage: blender --background --python extract_horse.py
"""

import bpy
import json

GLB_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/new_horse.glb"
OUT_PATH = r"c:/Users/Boris/Documents/Clocrown/myGameJam/exploration/fbx_way/horse_mesh.json"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    mesh_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            mesh_obj = obj
            break

    mesh = mesh_obj.data
    mesh.calc_loop_triangles()
    mat = mesh_obj.matrix_world

    # Blender-space (Z-up) positions first.
    blender_positions = [mat @ v.co for v in mesh.vertices]

    # Center on the XY (width/depth) axes, and sit the mesh on Z=0 (feet
    # on the ground) rather than centering vertically.
    xs = [p.x for p in blender_positions]
    ys = [p.y for p in blender_positions]
    zs = [p.z for p in blender_positions]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    minz = min(zs)

    # Remap to game convention: game.x = blender.x, game.y = blender.z (up),
    # game.z = blender.y (forward/depth).
    positions = []
    for p in blender_positions:
        gx = p.x - cx
        gy = p.z - minz
        gz = p.y - cy
        positions.append([round(gx, 4), round(gy, 4), round(gz, 4)])

    # Remapping Blender's Z-up (X width, Y depth, Z height) to the game's
    # Y-up (X width, Y height, Z depth) swaps two axes, which is a
    # reflection (flips chirality) and reverses every triangle's winding.
    # Reverse the vertex order here to restore CCW-front-facing so
    # gl.CULL_FACE (back-face culling, enabled in game.js) doesn't discard
    # half the mesh.
    indices = []
    for tri in mesh.loop_triangles:
        indices.extend([tri.vertices[0], tri.vertices[2], tri.vertices[1]])

    gxs = [p[0] for p in positions]
    gys = [p[1] for p in positions]
    gzs = [p[2] for p in positions]
    bbox = {
        "min": [min(gxs), min(gys), min(gzs)],
        "max": [max(gxs), max(gys), max(gzs)],
    }

    out = {
        "vertexCount": len(positions),
        "triCount": len(indices) // 3,
        "positions": positions,
        "indices": indices,
        "bbox": bbox,
    }

    with open(OUT_PATH, "w") as f:
        json.dump(out, f)

    print("=== EXTRACTED (game-space) ===", flush=True)
    print("vertices:", len(positions), "tris:", len(indices)//3, flush=True)
    print("bbox:", bbox, flush=True)
    print("width(x):", bbox["max"][0]-bbox["min"][0], flush=True)
    print("height(y):", bbox["max"][1]-bbox["min"][1], flush=True)
    print("depth(z):", bbox["max"][2]-bbox["min"][2], flush=True)
    print("written to:", OUT_PATH, flush=True)


try:
    main()
except Exception as e:
    print(">>> FATAL ERROR:", e, flush=True)
    import traceback
    traceback.print_exc()
