"""
Generates an organic-shaped, rigged unicorn/horse mesh in Blender.

Run inside Blender's Scripting tab (Blender 5.2+): open this file, click
Run Script. It builds the mesh + a full quadruped armature (spine, neck,
head, horn, tail, 4 legs with a knee/pastern joint each), applies
automatic-weight skinning, and leaves everything in rest pose so it's
ready to export as glTF (Mesh + Scene Graph + Armature + Skinning checked,
Animation unchecked since the gallop cycle stays in JS).

The body is built from a chain of metaball-like lofted sections instead of
raw cubes, so the surface curves smoothly instead of reading as boxes --
this is the "organic" version, meant to look like a stylized horse rather
than a block character.
"""

import bpy
import bmesh
import math
from mathutils import Vector

# ---- Cleanup: remove any previous generated objects so re-running the
# script is idempotent instead of piling up duplicates, and also drop
# Blender's default startup Cube/Camera/Light so the export only contains
# what this script actually builds. ----
for name in ["Unicorn", "UnicornArmature", "Cube", "Camera", "Light"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)


def add_chain_elements(mball_data, points_radii, subdiv=3):
    """
    Adds metaball elements tracing a path through the given (position,
    radius) control points, into a shared metaball data-block so they blend
    into everything else already in it.

    Metaballs only fuse into one surface where neighboring elements'
    influence spheres overlap enough -- roughly when the distance between
    them is well under the sum of their radii. A handful of widely-spaced
    control points (e.g. 4 points tracing a 1.5m neck) fails that: the gaps
    between them are too big relative to how thin the neck is, so each
    control point ends up as its own disconnected blob instead of one
    smooth tube. `subdiv` linearly-interpolated points are inserted between
    each pair of control points to close those gaps without changing the
    traced shape or thickness.
    """
    for i in range(len(points_radii) - 1):
        pos_a, radius_a = points_radii[i]
        pos_b, radius_b = points_radii[i + 1]
        steps = subdiv + 1 if i < len(points_radii) - 2 else subdiv + 2
        for step in range(steps):
            t = step / (subdiv + 1)
            pos = tuple(pos_a[k] + (pos_b[k] - pos_a[k]) * t for k in range(3))
            radius = radius_a + (radius_b - radius_a) * t
            element = mball_data.elements.new()
            element.co = pos
            element.radius = radius
            element.stiffness = 2.0


# ---- Body layout, in local space: +Z forward (toward the head), +Y up,
# matching the convention already used by the JS rig. Units are meters.
#
# All body parts (torso/neck/head/tail/legs) are elements of a SINGLE
# metaball data-block: metaballs only blend into one smooth organic surface
# with elements that belong to the same object, so keeping them separate
# per-part (as an earlier version of this script did) produced disconnected
# floating blobs instead of a unicorn. The horn stays a separate rigid cone
# since it shouldn't organically melt into the head. ----

mball_data = bpy.data.metaballs.new("UnicornMetaData")
mball_data.resolution = 0.15
mball_data.render_resolution = 0.15
mball_obj = bpy.data.objects.new("UnicornMeta", mball_data)
bpy.context.collection.objects.link(mball_obj)

# Torso: haunch to chest.
add_chain_elements(mball_data, [
    ((0, 2.6, -1.1), 0.85),   # haunch (rear)
    ((0, 2.7, -0.4), 0.95),   # mid-back
    ((0, 2.7, 0.4), 0.9),     # withers (front back)
    ((0, 2.5, 1.0), 0.6),     # chest
])

# Neck: curves upward and forward from the chest toward the head.
add_chain_elements(mball_data, [
    ((0, 2.6, 1.05), 0.42),
    ((0, 3.1, 1.35), 0.34),
    ((0, 3.6, 1.55), 0.27),
    ((0, 3.95, 1.65), 0.22),
])

# Head: a tapered snout continuing from the neck.
add_chain_elements(mball_data, [
    ((0, 4.05, 1.75), 0.24),
    ((0, 4.1, 2.15), 0.18),
    ((0, 4.05, 2.5), 0.1),
])

# Tail: hangs down and back from the haunch.
#
# NOTE: where the tail's start point sits close to the back legs' torso
# anchor (see add_leg_elements below), their overlapping influence spheres
# can blend into a twisted, non-manifold patch of geometry (a jagged
# crease) instead of splitting cleanly into two separate limbs -- this is
# sensitive to exact distances/radii in a way that's hard to get right by
# calculation alone. If you see that artifact after running this script:
# select the "UnicornMeta" ... actually the metaball is already converted
# to a mesh by this point, so instead select "Unicorn", go to Edit Mode,
# and nudge/scale the vertices around the tail-hip seam directly; or
# increase the z-offset of the tail's first point below and re-run.
add_chain_elements(mball_data, [
    ((0, 2.6, -1.5), 0.22),
    ((0, 1.7, -1.75), 0.16),
    ((0, 1.0, -1.9), 0.11),
    ((0, 0.4, -1.98), 0.07),
])


def add_leg_elements(x_sign, z, torso_y, anchor_radius=0.5):
    """
    One leg: shoulder/hip -> knee -> pastern -> hoof, tapering down. Starts
    from inside the torso (torso_y, at the body centerline x=0) rather than
    already out at the leg's own x offset, so the chain overlaps enough
    with the torso body to fuse into it instead of floating as a separate
    blob (see add_chain_elements' docstring for why the gap matters).
    `anchor_radius` is tunable per-leg: the back legs' anchor sits close to
    the tail's start point, so its influence sphere is kept smaller there
    to avoid a three-way blend with the tail that produces twisted,
    non-manifold geometry at the seam.
    """
    top_y, knee_y, pastern_y, hoof_y = 2.1, 1.1, 0.4, 0.05
    x = x_sign * 0.55
    add_chain_elements(mball_data, [
        ((0, torso_y, z), anchor_radius),
        ((x, top_y, z), 0.26),
        ((x, knee_y, z), 0.19),
        ((x, pastern_y, z), 0.13),
        ((x, hoof_y, z), 0.14),
    ])


add_leg_elements(-1, 1.0, torso_y=2.5)                        # front-left, shoulder near the chest
add_leg_elements(1, 1.0, torso_y=2.5)                         # front-right
add_leg_elements(-1, -1.0, torso_y=2.6, anchor_radius=0.3)    # back-left, hip near the haunch
add_leg_elements(1, -1.0, torso_y=2.6, anchor_radius=0.3)     # back-right

# Convert the fully-assembled metaball into a real, standalone mesh.
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
eval_obj = mball_obj.evaluated_get(depsgraph)
mesh_from_eval = bpy.data.meshes.new_from_object(eval_obj)

unicorn = bpy.data.objects.new("Unicorn", mesh_from_eval)
bpy.context.collection.objects.link(unicorn)
bpy.data.objects.remove(mball_obj, do_unlink=True)

bpy.context.view_layer.objects.active = unicorn
unicorn.select_set(True)

# Horn: a thin rigid cone on top of the head, joined onto the mesh. Its
# base is placed so it plunges into the head's top metaball point
# (0, 4.1, 2.15) rather than floating just above the skin -- the cone's
# base radius (0.08) is much smaller than that point's radius (0.18), so
# without overlap it reads as a separate detached spike instead of a horn
# growing out of the skull.
horn_angle = math.radians(-20)
horn_depth = 0.9
head_anchor = Vector((0, 4.1, 2.15))
# The cone's local +Z axis (tip direction) after an X-axis rotation by
# horn_angle is (0, -sin(horn_angle), cos(horn_angle)) -- NOT
# (0, cos, sin), which points the cone almost sideways into empty space
# instead of up through the skull. Bury the base 0.15m past the anchor
# point along this corrected axis so the cone's wide end sits inside the
# head instead of floating just outside it.
horn_dir = Vector((0, -math.sin(horn_angle), math.cos(horn_angle)))
horn_center = head_anchor - horn_dir * 0.15 + horn_dir * (horn_depth / 2)

bpy.ops.mesh.primitive_cone_add(
    radius1=0.09, radius2=0.015, depth=horn_depth,
    location=horn_center
)
horn = bpy.context.active_object
horn.rotation_euler = (horn_angle, 0, 0)
horn.name = "Horn"
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

bpy.ops.object.select_all(action="DESELECT")
unicorn.select_set(True)
horn.select_set(True)
bpy.context.view_layer.objects.active = unicorn
bpy.ops.object.join()
unicorn = bpy.context.active_object
unicorn.name = "Unicorn"

# The metaball-to-mesh conversion + join can leave duplicate geometry at
# the seam between the horn and the head; clean that up so the exported
# mesh is valid.
bpy.ops.object.mode_set(mode="EDIT")
bm = bmesh.from_edit_mesh(unicorn.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
bmesh.update_edit_mesh(unicorn.data)
bpy.ops.object.mode_set(mode="OBJECT")

# Smooth shading reads much better on a lofted organic mesh than flat faces.
bpy.ops.object.shade_smooth()

# ---- Armature: one bone chain per body part, matching the JS rig's
# node names 1:1 so the exported hierarchy is easy to map back to the
# existing animation code (body/neck/head/horn/tail/leg-*/hoof-*). ----

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = "UnicornArmature"
armature = armature_obj.data
armature.name = "UnicornArmatureData"

edit_bones = armature.edit_bones
edit_bones.remove(edit_bones[0])  # drop the default single bone


def make_bone(name, head, tail, parent=None, connected=False):
    bone = edit_bones.new(name)
    bone.head = Vector(head)
    bone.tail = Vector(tail)
    if parent:
        bone.parent = edit_bones[parent]
        bone.use_connect = connected
    return bone


make_bone("body", (0, 2.6, -1.1), (0, 2.6, 1.0))
make_bone("neck", (0, 2.6, 1.05), (0, 3.95, 1.65), parent="body")
make_bone("head", (0, 3.95, 1.65), (0, 4.05, 2.5), parent="neck", connected=True)
make_bone("horn", (0, 4.05, 2.0), (0, 4.85, 1.75), parent="head")

make_bone("tail", (0, 2.4, -1.2), (0, 1.0, -1.75), parent="body")
make_bone("tail-tip", (0, 1.0, -1.75), (0, 0.4, -1.85), parent="tail", connected=True)


def make_leg_bones(prefix, x_sign, z):
    x = x_sign * 0.55
    make_bone(prefix, (x, 2.1, z), (x, 1.1, z), parent="body")
    make_bone(prefix + "-lower", (x, 1.1, z), (x, 0.05, z), parent=prefix, connected=True)


make_leg_bones("leg-fl", -1, 1.0)
make_leg_bones("leg-fr", 1, 1.0)
make_leg_bones("leg-bl", -1, -1.0)
make_leg_bones("leg-br", 1, -1.0)

bpy.ops.object.mode_set(mode="OBJECT")

# ---- Skin the mesh to the armature with automatic weights. ----
bpy.ops.object.select_all(action="DESELECT")
unicorn.select_set(True)
armature_obj.select_set(True)
bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

# Blender's automatic-weights solver can leave weights fractionally over
# 1.0 (e.g. 1.0000001) from floating point rounding; mesh.validate() flags
# those as errors even though they're visually harmless. Clamp them so the
# exported mesh validates cleanly.
for group in unicorn.vertex_groups:
    for vertex in unicorn.data.vertices:
        for ve_group in vertex.groups:
            if ve_group.group == group.index and ve_group.weight > 1.0:
                ve_group.weight = 1.0

print("Done: 'Unicorn' mesh rigged to 'UnicornArmature'.")
print("Export via File > Export > glTF 2.0 with Mesh, Scene Graph, Armature and Skinning checked.")
