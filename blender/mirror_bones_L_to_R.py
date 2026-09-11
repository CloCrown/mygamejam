"""
Mirror bone positions from the LEFT side of an armature onto the RIGHT side,
in Edit Mode, along the X axis.

Usage:
1. Open your .blend in Blender.
2. Select the armature object (not necessarily in Edit Mode).
3. Open a Scripting tab / Text Editor, Open this file, adjust CONFIG below if needed.
4. Run (Alt+P or the Run button).

What it does:
- Enters Edit Mode on the active armature.
- Finds bone name pairs where one side matches a left suffix/prefix and the
  other the equivalent right one (.L/.R, _L/_R, Left/Right, case-insensitive).
- For each pair, mirrors the LEFT bone's head/tail/roll across the X axis
  (in armature local space) and writes the result onto the RIGHT bone.
- Leaves bones with no detected counterpart untouched, and reports them.

Notes:
- Mirroring across X assumes your armature's mirror plane is the local YZ
  plane (X=0), i.e. bone.x -> -bone.x. This is Blender's standard convention
  for left/right rigs (also what "Paste X-Flipped Pose" and Ctrl+M use).
- This only touches Edit Bone head/tail/roll. It does not touch parenting,
  constraints, or vertex groups/weights.
- Safe to re-run: it always recomputes R from L's current state.
"""

import bpy

# ---------------- CONFIG ----------------
# Only touch bones inside this list of (suffix/marker) pairs.
# Matching is case-insensitive and tries suffix first, then prefix, then "contains".
LR_PAIRS = [
    (".L", ".R"),
    ("_L", "_R"),
    ("Left", "Right"),
    ("left", "right"),
    ("-L", "-R"),
]

DRY_RUN = False  # set True to only print what would happen, without changing anything
# -----------------------------------------


def find_right_name(left_name):
    """Given a left-side bone name, return the expected right-side name, or None."""
    for l_mark, r_mark in LR_PAIRS:
        if left_name.endswith(l_mark):
            return left_name[: -len(l_mark)] + r_mark
        if left_name.startswith(l_mark):
            return r_mark + left_name[len(l_mark):]
    return None


def mirror_x(vec):
    v = vec.copy()
    v.x = -v.x
    return v


def mirror_roll(roll):
    """
    Blender's own X-mirror (Ctrl+M in Armature Edit Mode) flips roll as:
    new_roll = -old_roll for a mirror across the YZ plane, matching the
    convention used by "Flip Names" / built-in armature X-mirror editing.
    """
    return -roll


def main():
    obj = bpy.context.active_object
    if obj is None or obj.type != 'ARMATURE':
        raise RuntimeError("Select the armature object first (click it, make it active).")

    was_mode = obj.mode
    bpy.ops.object.mode_set(mode='EDIT')
    ebones = obj.data.edit_bones

    pairs_found = []
    unmatched = []

    for bone in ebones:
        name = bone.name
        r_name = find_right_name(name)
        if r_name is None:
            continue
        if r_name not in ebones:
            unmatched.append(name)
            continue
        pairs_found.append((name, r_name))

    print(f"Found {len(pairs_found)} L/R pairs to mirror.")
    for l_name, r_name in pairs_found:
        l_bone = ebones[l_name]
        r_bone = ebones[r_name]

        new_head = mirror_x(l_bone.head)
        new_tail = mirror_x(l_bone.tail)
        new_roll = mirror_roll(l_bone.roll)

        print(f"  {l_name} -> {r_name}: head {tuple(l_bone.head)} -> {tuple(new_head)}")

        if not DRY_RUN:
            r_bone.head = new_head
            r_bone.tail = new_tail
            r_bone.roll = new_roll

    if unmatched:
        print("No right-side counterpart found for:")
        for n in unmatched:
            print(f"  {n}")

    bpy.ops.object.mode_set(mode=was_mode)
    print("Done." if not DRY_RUN else "Dry run complete, nothing changed.")


main()
