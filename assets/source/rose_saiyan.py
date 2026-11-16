"""
Builds an original stylized "Rosé Saiyan" fighter: mesh + humanoid rig.
All geometry is original (primitives), no copyrighted assets.
Exports a GLB with named bones for procedural animation in three.js.
"""
import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]

# ---- clean scene ----
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.meshes): bpy.data.meshes.remove(d)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)

# ---- palette (hex -> linear-ish sRGB tuple) ----
def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)

def material(name, color, rough=0.75, metal=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = hexc(color)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = hexc(color)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    return m

MATS = {
    "gi": material("Gi_DarkIndigo", "#232a4a"),
    "gi2": material("Gi_Panel", "#1b2038"),
    "sash": material("Sash_Crimson", "#b8323a"),
    "skin": material("Skin_Warm", "#e6b08a"),
    "hair": material("Hair_Black", "#0c0c14", 0.6),
    "boot": material("Boot_Dark", "#15182a"),
    "eye": material("Eye_White", "#f7f4ee", 0.4),
    "pupil": material("Pupil_Dark", "#101018", 0.3),
    "brow": material("Brow_Black", "#0c0c14"),
    "gold": material("Gold_Trim", "#d8b24a", 0.5, 0.3),
}

# ---- armature ----
bpy.ops.object.armature_add(enter_editmode=False, location=(0, 0, 0))
arm = bpy.context.object
arm.name = "RoseSaiyan_Rig"
bpy.ops.object.mode_set(mode="EDIT")
arm.data.edit_bones.remove(arm.data.edit_bones[0])  # default bone

def bone(name, head, tail, parent=None):
    b = arm.data.edit_bones.new(name)
    b.head = head
    b.tail = tail
    if parent:
        b.parent = arm.data.edit_bones[parent]
    return b

# Z-up. Character faces +Y. Height ~1.75
bone("root",        (0, 0, 0.0),    (0, 0, 0.1))
bone("hips",        (0, 0, 0.92),   (0, 0, 1.02),  "root")
bone("spine",       (0, 0, 1.02),   (0, 0, 1.22),  "hips")
bone("chest",       (0, 0, 1.22),   (0, 0, 1.42),  "spine")
bone("neck",        (0, 0, 1.42),   (0, 0, 1.50),  "chest")
bone("head",        (0, 0, 1.50),   (0, 0, 1.68),  "neck")
for side, sx in (("L", 1), ("R", -1)):
    bone(f"shoulder.{side}", (0.10*sx, 0, 1.42), (0.24*sx, 0, 1.42), "chest")
    bone(f"upperArm.{side}", (0.24*sx, 0, 1.42), (0.27*sx, 0, 1.14), f"shoulder.{side}")
    bone(f"lowerArm.{side}", (0.27*sx, 0, 1.14), (0.28*sx, 0, 0.90), f"upperArm.{side}")
    bone(f"hand.{side}",     (0.28*sx, 0, 0.90), (0.28*sx, 0, 0.82), f"lowerArm.{side}")
    bone(f"thigh.{side}",    (0.12*sx, 0, 0.92), (0.13*sx, 0, 0.52), "hips")
    bone(f"shin.{side}",     (0.13*sx, 0, 0.52), (0.13*sx, 0, 0.12), f"thigh.{side}")
    bone(f"foot.{side}",     (0.13*sx, 0, 0.12), (0.13*sx, 0.10, 0.06), f"shin.{side}")
bpy.ops.object.mode_set(mode="OBJECT")

# ---- helpers ----
def finish(obj, mat, bone_name, smooth=True):
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    obj.data.materials.append(mat)
    if bone_name:
        vg = obj.vertex_groups.new(name=bone_name)
        vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
    return obj

def sphere(name, loc, scale, mat, bone_name, seg=20, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o = bpy.context.object; o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, mat, bone_name)

def box(name, loc, dims, mat, bone_name, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    o.scale = (dims[0]/2, dims[1]/2, dims[2]/2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, mat, bone_name, smooth=False)

def cone(name, loc, radius, depth, mat, bone_name, rot=(0,0,0), verts=6):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=0.0, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return finish(o, mat, bone_name, smooth=False)

def cyl(name, loc, radius, depth, mat, bone_name, rot=(0,0,0), verts=14):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return finish(o, mat, bone_name)

# ================= BODY =================
# pelvis / hips
sphere("Pelvis", (0, 0, 0.94), (0.19, 0.13, 0.14), MATS["gi"], "hips")
# torso - tapered: lower abdomen + chest
sphere("Abdomen", (0, 0, 1.10), (0.20, 0.135, 0.18), MATS["gi"], "spine")
sphere("Chest",   (0, 0, 1.32), (0.245, 0.15, 0.18), MATS["gi"], "chest")
# undershirt V at collar
sphere("Collar",  (0, 0.02, 1.42), (0.16, 0.10, 0.07), MATS["skin"], "chest")
# neck
cyl("Neck", (0, 0, 1.47), 0.075, 0.14, MATS["skin"], "neck")

# belt / sash
box("SashFront", (0, 0.135, 1.00), (0.40, 0.06, 0.11), MATS["sash"], "hips")
box("SashBack",  (0, -0.135, 1.00), (0.40, 0.06, 0.11), MATS["sash"], "hips")
box("SashL",     (-0.19, 0, 1.00), (0.06, 0.28, 0.11), MATS["sash"], "hips")
box("SashR",     (0.19, 0, 1.00), (0.06, 0.28, 0.11), MATS["sash"], "hips")
# gi skirt flaps
box("GiFlapFront", (0, 0.12, 0.88), (0.34, 0.05, 0.20), MATS["gi2"], "hips")
box("GiFlapBack",  (0, -0.12, 0.88), (0.34, 0.05, 0.20), MATS["gi2"], "hips")

# ================= HEAD =================
sphere("Head", (0, 0, 1.60), (0.155, 0.15, 0.17), MATS["skin"], "head", 24, 18)
# jaw
sphere("Jaw", (0, 0.02, 1.52), (0.12, 0.12, 0.08), MATS["skin"], "head")
# ears
sphere("Ear.L", (0.155, 0, 1.60), (0.035, 0.05, 0.07), MATS["skin"], "head")
sphere("Ear.R", (-0.155, 0, 1.60), (0.035, 0.05, 0.07), MATS["skin"], "head")
# eyes (face +Y)
for sx, s in ((1,"L"), (-1,"R")):
    sphere(f"Eye.{s}", (0.06*sx, 0.135, 1.625), (0.032, 0.018, 0.020), MATS["eye"], "head", 14, 10)
    sphere(f"Pupil.{s}", (0.06*sx, 0.150, 1.625), (0.017, 0.010, 0.017), MATS["pupil"], "head", 12, 8)
    box(f"Brow.{s}", (0.06*sx, 0.140, 1.665), (0.075, 0.012, 0.014), MATS["brow"], "head", rot=(0, 0, -0.12*sx))
# nose
cone("Nose", (0, 0.155, 1.575), 0.018, 0.05, MATS["skin"], "head", rot=(math.pi/2, 0, 0), verts=6)
# mouth
box("Mouth", (0, 0.145, 1.535), (0.055, 0.008, 0.012), MATS["brow"], "head")

# hair - base cap + spiky cones
sphere("HairCap", (0, -0.01, 1.735), (0.165, 0.15, 0.065), MATS["hair"], "head", 16, 12)
spikes = [
    ((0, -0.02, 1.83), 0.0, 0.0, 0.30, 0.065),
    ((0.075, 0.0, 1.80), 0.0, -0.35, 0.27, 0.058),
    ((-0.075, 0.0, 1.80), 0.0, 0.35, 0.27, 0.058),
    ((0.13, -0.04, 1.76), -0.15, -0.6, 0.24, 0.05),
    ((-0.13, -0.04, 1.76), -0.15, 0.6, 0.24, 0.05),
    ((0.0, -0.10, 1.78), -0.5, 0.0, 0.26, 0.055),
    ((0.08, -0.08, 1.77), -0.35, -0.3, 0.22, 0.048),
    ((-0.08, -0.08, 1.77), -0.35, 0.3, 0.22, 0.048),
    ((0.0, 0.06, 1.80), 0.15, 0.0, 0.16, 0.04),   # short fringe, above eyes
    ((0.05, 0.07, 1.79), 0.15, -0.25, 0.14, 0.035),
    ((-0.05, 0.07, 1.79), 0.15, 0.25, 0.14, 0.035),
]
for i, (loc, rx, rz, dep, rad) in enumerate(spikes):
    cone(f"HairSpike_{i:02d}", loc, rad, dep, MATS["hair"], "head", rot=(rx, 0, rz))

# ================= ARMS =================
for side, sx in (("L", 1), ("R", -1)):
    sphere(f"ShoulderPad.{side}", (0.25*sx, 0, 1.41), (0.105, 0.115, 0.115), MATS["gi"], f"shoulder.{side}")
    sphere(f"UpperArm.{side}", (0.255*sx, 0, 1.28), (0.078, 0.082, 0.16), MATS["gi"], f"upperArm.{side}")
    sphere(f"Elbow.{side}", (0.27*sx, 0, 1.14), (0.072, 0.072, 0.07), MATS["gi"], f"lowerArm.{side}")
    sphere(f"Forearm.{side}", (0.28*sx, 0, 1.02), (0.068, 0.07, 0.13), MATS["skin"], f"lowerArm.{side}")
    # red wristband
    cyl(f"Wristband.{side}", (0.28*sx, 0, 0.925), 0.073, 0.07, MATS["sash"], f"lowerArm.{side}")
    sphere(f"Fist.{side}", (0.28*sx, 0, 0.86), (0.072, 0.07, 0.075), MATS["skin"], f"hand.{side}")

# ================= LEGS =================
for side, sx in (("L", 1), ("R", -1)):
    sphere(f"Thigh.{side}", (0.125*sx, 0, 0.72), (0.10, 0.105, 0.22), MATS["gi"], f"thigh.{side}")
    sphere(f"Knee.{side}", (0.13*sx, 0, 0.52), (0.085, 0.085, 0.08), MATS["gi"], f"shin.{side}")
    sphere(f"Shin.{side}", (0.13*sx, 0, 0.32), (0.078, 0.082, 0.20), MATS["gi"], f"shin.{side}")
    # boot
    box(f"Boot.{side}", (0.13*sx, 0.02, 0.14), (0.15, 0.20, 0.18), MATS["boot"], f"foot.{side}")
    box(f"BootTrim.{side}", (0.13*sx, 0.02, 0.225), (0.155, 0.205, 0.035), MATS["sash"], f"foot.{side}")

# ---- export ----
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
)
print("EXPORTED", OUT, os.path.getsize(OUT) if os.path.exists(OUT) else "MISSING")
print("BONES", len(arm.data.bones), "MESHES", len([o for o in bpy.context.scene.objects if o.type == "MESH"]))
