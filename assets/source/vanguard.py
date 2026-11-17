"""
Builds "Vanguard" - an original, higher-fidelity stylized martial artist.

Everything here is generated geometry: lofted elliptical cross-sections for the
body, a sheared hair cap with strand spikes, layered cloth shells and analytic
skin weights. No external assets, no copyrighted likeness.

Usage:
    blender --background --python vanguard.py -- <out.glb> [preview_dir]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import vanguard_lib as L  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None

L.reset_scene()

# ---------------------------------------------------------------- materials
M = {
    "skin": L.material("Skin", "#c98c65", 0.55),
    "skin_dk": L.material("Skin_Deep", "#a86f4e", 0.6),
    "hair": L.material("Hair", "#14141f", 0.36),
    "gi": L.material("Gi_Navy", "#2c3450", 0.88),
    "gi_dk": L.material("Gi_Navy_Dark", "#1d2438", 0.9),
    "sash": L.material("Sash_Crimson", "#9e2b33", 0.78),
    "wrap": L.material("Wrap_Offwhite", "#d3cbbb", 0.9),
    "boot": L.material("Boot_Leather", "#1a1c25", 0.55),
    "sole": L.material("Sole", "#0f1116", 0.8),
    "eye": L.material("Eye_White", "#eae6de", 0.35),
    "iris": L.material("Iris", "#4a3326", 0.28),
    "pupil": L.material("Pupil", "#0a0a12", 0.2),
    "glint": L.material("Eye_Glint", "#ffffff", 0.1),
    "mouth": L.material("Mouth", "#6d3b39", 0.6),
    "brow": L.material("Brow", "#171720", 0.5),
}

# --------------------------------------------------------------------- rig
BONES = [
    ("root", (0, 0, 0.0), (0, 0, 0.12), None),
    ("hips", (0, 0, 0.97), (0, 0, 1.07), "root"),
    ("spine", (0, 0, 1.07), (0, 0, 1.25), "hips"),
    ("chest", (0, 0, 1.25), (0, 0, 1.44), "spine"),
    ("neck", (0, 0, 1.44), (0, 0, 1.54), "chest"),
    ("head", (0, 0, 1.54), (0, 0, 1.74), "neck"),
]
for s, sx in (("L", 1.0), ("R", -1.0)):
    BONES += [
        ("shoulder." + s, (0.040 * sx, 0, 1.430), (0.185 * sx, 0, 1.440), "chest"),
        ("upperArm." + s, (0.185 * sx, 0, 1.440), (0.233 * sx, 0, 1.160), "shoulder." + s),
        ("lowerArm." + s, (0.233 * sx, 0, 1.160), (0.246 * sx, 0, 0.930), "upperArm." + s),
        ("hand." + s, (0.246 * sx, 0, 0.930), (0.248 * sx, 0.012, 0.800), "lowerArm." + s),
        ("thigh." + s, (0.098 * sx, 0, 0.950), (0.107 * sx, 0, 0.540), "hips"),
        ("shin." + s, (0.107 * sx, 0, 0.540), (0.107 * sx, 0, 0.110), "thigh." + s),
        ("foot." + s, (0.107 * sx, 0, 0.110), (0.107 * sx, 0.150, 0.040), "shin." + s),
    ]

rig = L.Rig(BONES)

TORSO = ["hips", "spine", "chest", "neck"]
HEAD = ["neck", "head"]
ARM = {s: ["chest", "shoulder." + s, "upperArm." + s, "lowerArm." + s, "hand." + s] for s in "LR"}
LEG = {s: ["hips", "thigh." + s, "shin." + s, "foot." + s] for s in "LR"}

# -------------------------------------------------------------------- torso
TORSO_PATH = [
    ((0, 0.006, 0.862), (0.150, 0.106)),
    ((0, 0.005, 0.912), (0.167, 0.114)),
    ((0, 0.003, 0.972), (0.164, 0.111)),
    ((0, 0.000, 1.042), (0.150, 0.101)),
    ((0, 0.000, 1.112), (0.164, 0.110)),
    ((0, -0.002, 1.188), (0.184, 0.120)),
    ((0, -0.004, 1.262), (0.201, 0.128)),
    ((0, -0.004, 1.330), (0.209, 0.131)),
    ((0, -0.002, 1.386), (0.206, 0.126)),
    ((0, 0.000, 1.424), (0.176, 0.114)),
    ((0, 0.002, 1.452), (0.142, 0.104)),
    ((0, 0.004, 1.472), (0.118, 0.096)),
    ((0, 0.006, 1.496), (0.098, 0.087)),
    ((0, 0.008, 1.518), (0.078, 0.075)),
    ((0, 0.010, 1.542), (0.069, 0.068)),
]
rig.tube("Torso", M["skin"], [p for p, _ in TORSO_PATH],
         [r for _, r in TORSO_PATH], TORSO, n=22)

# --------------------------------------------------------------------- head
HEAD_PATH = [
    ((0, 0.016, 1.506), (0.026, 0.031)),
    ((0, 0.014, 1.520), (0.046, 0.053)),
    ((0, 0.012, 1.536), (0.066, 0.078)),
    ((0, 0.010, 1.558), (0.082, 0.095)),
    ((0, 0.007, 1.582), (0.094, 0.105)),
    ((0, 0.004, 1.608), (0.101, 0.111)),
    ((0, 0.002, 1.634), (0.103, 0.112)),
    ((0, 0.000, 1.658), (0.100, 0.108)),
    ((0, -0.002, 1.682), (0.095, 0.101)),
    ((0, -0.004, 1.704), (0.083, 0.087)),
    ((0, -0.006, 1.720), (0.061, 0.063)),
    ((0, -0.008, 1.732), (0.031, 0.033)),
]
rig.tube("Head", M["skin"], [p for p, _ in HEAD_PATH],
         [r for _, r in HEAD_PATH], HEAD, n=24)

rig.tube("Nose", M["skin"], [
    (0, 0.113, 1.641), (0, 0.123, 1.622), (0, 0.128, 1.608), (0, 0.121, 1.598),
], [(0.006, 0.007), (0.008, 0.009), (0.0085, 0.009), (0.007, 0.006)], HEAD, n=12)

for s, sx in (("L", 1.0), ("R", -1.0)):
    rig.ellipse("Ear." + s, M["skin"], (0.098 * sx, 0.004, 1.602),
                (0.009, 0.018, 0.026), HEAD, n=14, rings=8)
    # eyeball, iris, pupil, specular glint
    rig.ellipse("EyeWhite." + s, M["eye"], (0.041 * sx, 0.0955, 1.632),
                (0.019, 0.011, 0.011), HEAD, n=18, rings=10)
    rig.ellipse("Iris." + s, M["iris"], (0.041 * sx, 0.1030, 1.6315),
                (0.0092, 0.0045, 0.0092), HEAD, n=16, rings=8)
    rig.ellipse("Pupil." + s, M["pupil"], (0.041 * sx, 0.1052, 1.6315),
                (0.0044, 0.0032, 0.0044), HEAD, n=14, rings=8)
    rig.ellipse("Glint." + s, M["glint"], (0.0438 * sx, 0.1070, 1.6344),
                (0.0020, 0.0016, 0.0020), HEAD, n=10, rings=6)
    # brow
    rig.tube("Brow." + s, M["brow"], [
        (0.016 * sx, 0.1100, 1.6510), (0.044 * sx, 0.1005, 1.6580),
        (0.068 * sx, 0.0830, 1.6540),
    ], [(0.0045, 0.0026), (0.0040, 0.0024), (0.0022, 0.0018)], HEAD, n=10)

rig.tube("Mouth", M["mouth"], [
    (-0.022, 0.1035, 1.5570), (0.0, 0.1085, 1.5535), (0.022, 0.1035, 1.5570),
], [0.0028, 0.0032, 0.0028], HEAD, n=10)

# --------------------------------------------------------------------- hair
# Skull cap: horizontal rings sheared so the hairline sits high at the front
# and drops to the nape at the back.
CAP = [
    (1.618, 0.108, 0.110, -0.010, 0.62),
    (1.652, 0.117, 0.124, -0.012, 0.50),
    (1.682, 0.114, 0.120, -0.012, 0.34),
    (1.706, 0.100, 0.104, -0.014, 0.20),
    (1.724, 0.074, 0.077, -0.016, 0.10),
    (1.736, 0.040, 0.042, -0.018, 0.03),
    (1.741, 0.012, 0.013, -0.019, 0.00),
]
n = 22
verts, faces = [], []
for z0, rx, ry, yc, shear in CAP:
    for i in range(n):
        th = 2.0 * math.pi * i / n
        y = yc + ry * math.sin(th)
        verts.append((rx * math.cos(th), y, z0 + shear * (y - yc)))
for k in range(len(CAP) - 1):
    a, b = k * n, (k + 1) * n
    for i in range(n):
        j = (i + 1) % n
        faces.append((a + i, a + j, b + j, b + i))
me = bpy.data.meshes.new("HairCap")
me.from_pydata(verts, [], faces)
me.validate()
me.materials.append(M["hair"])
for poly in me.polygons:
    poly.use_smooth = True
cap = bpy.data.objects.new("HairCap", me)
bpy.context.collection.objects.link(cap)
rig.add(cap, HEAD)

# Locks are anchored 45% of the way inside the skull so only their tapered
# tips emerge from the cap - that is what stops them reading as fins.
HEAD_C = Vector((0.0, -0.006, 1.662))
LOCKS = [
    # crown, swept up and back
    ((0.000, -0.020, 1.738), (0.00, -0.35, 1.00), 0.110, 0.050, 0.020),
    ((0.070, -0.030, 1.722), (0.35, -0.40, 0.95), 0.100, 0.045, 0.019),
    ((-0.070, -0.030, 1.722), (-0.35, -0.40, 0.95), 0.100, 0.045, 0.019),
    ((0.035, 0.040, 1.732), (0.20, 0.30, 1.00), 0.090, 0.042, 0.018),
    ((-0.035, 0.040, 1.732), (-0.20, 0.30, 1.00), 0.090, 0.042, 0.018),
    # back of the skull
    ((0.000, -0.110, 1.700), (0.00, -0.80, 0.60), 0.170, 0.055, 0.022),
    ((0.060, -0.105, 1.695), (0.28, -0.78, 0.56), 0.160, 0.050, 0.021),
    ((-0.060, -0.105, 1.695), (-0.28, -0.78, 0.56), 0.160, 0.050, 0.021),
    ((0.110, -0.075, 1.676), (0.62, -0.70, 0.36), 0.150, 0.046, 0.020),
    ((-0.110, -0.075, 1.676), (-0.62, -0.70, 0.36), 0.150, 0.046, 0.020),
    ((0.030, -0.120, 1.660), (0.15, -0.94, 0.30), 0.150, 0.048, 0.020),
    ((-0.030, -0.120, 1.660), (-0.15, -0.94, 0.30), 0.150, 0.048, 0.020),
    ((0.085, -0.100, 1.645), (0.45, -0.86, 0.24), 0.130, 0.042, 0.019),
    ((-0.085, -0.100, 1.645), (-0.45, -0.86, 0.24), 0.130, 0.042, 0.019),
    ((0.000, -0.128, 1.625), (0.00, -0.90, -0.20), 0.120, 0.044, 0.019),
    ((0.055, -0.120, 1.620), (0.30, -0.85, -0.25), 0.110, 0.040, 0.018),
    ((-0.055, -0.120, 1.620), (-0.30, -0.85, -0.25), 0.110, 0.040, 0.018),
    # fringe, swept across the forehead
    ((-0.030, 0.107, 1.702), (0.60, 0.72, -0.10), 0.085, 0.040, 0.010),
    ((0.020, 0.110, 1.700), (0.40, 0.80, -0.12), 0.080, 0.038, 0.010),
    ((-0.085, 0.085, 1.694), (0.80, 0.45, -0.08), 0.070, 0.034, 0.009),
    # temples, flowing back
    ((0.115, 0.005, 1.660), (0.55, -0.75, -0.15), 0.085, 0.034, 0.016),
    ((-0.115, 0.005, 1.660), (-0.55, -0.75, -0.15), 0.085, 0.034, 0.016),
]
for idx, (base, direction, length, rx, ry) in enumerate(LOCKS):
    b = HEAD_C + (Vector(base) - HEAD_C) * 0.55
    d = Vector(direction).normalized()
    droop = 0.30 * max(0.0, d.z)
    path = [
        b,
        b + d * (length * 0.35),
        b + d * (length * 0.70) + Vector((0.0, 0.0, -droop * 0.45 * length)),
        b + d * length + Vector((0.0, 0.0, -droop * length)),
    ]
    rig.tube("Lock%02d" % idx, M["hair"], path, [
        (rx, ry), (rx * 0.90, ry * 0.88), (rx * 0.55, ry * 0.62), (0.004, 0.0035),
    ], HEAD, n=10, cap_start=False, cap_end=True)

for s, sx in (("L", 1.0), ("R", -1.0)):
    rig.tube("Sideburn." + s, M["hair"], [
        (0.100 * sx, 0.022, 1.650), (0.101 * sx, 0.016, 1.622), (0.101 * sx, 0.012, 1.600),
    ], [(0.013, 0.010), (0.010, 0.008), (0.005, 0.004)], HEAD, n=8,
        cap_start=False, cap_end=True)

# --------------------------------------------------------------------- arms
for s, sx in (("L", 1.0), ("R", -1.0)):
    rig.tube("Arm." + s, M["skin"], [
        (0.170 * sx, 0, 1.452), (0.192 * sx, 0, 1.408), (0.210 * sx, 0, 1.340),
        (0.222 * sx, 0, 1.270), (0.230 * sx, 0, 1.200), (0.234 * sx, 0, 1.160),
        (0.238 * sx, 0, 1.110), (0.242 * sx, 0, 1.050), (0.245 * sx, 0, 0.990),
        (0.246 * sx, 0, 0.940),
    ], [
        (0.064, 0.064), (0.078, 0.076), (0.074, 0.072), (0.066, 0.064),
        (0.056, 0.055), (0.050, 0.050), (0.055, 0.054), (0.054, 0.052),
        (0.046, 0.045), (0.038, 0.037),
    ], ARM[s], n=16)

    rig.tube("Hand." + s, M["skin"], [
        (0.246 * sx, 0.000, 0.945), (0.247 * sx, 0.004, 0.910),
        (0.248 * sx, 0.008, 0.870), (0.248 * sx, 0.012, 0.832),
        (0.246 * sx, 0.014, 0.805),
    ], [
        (0.030, 0.030), (0.028, 0.042), (0.028, 0.048),
        (0.026, 0.044), (0.018, 0.030),
    ], ARM[s], n=12)

    rig.tube("Thumb." + s, M["skin"], [
        (0.238 * sx, 0.018, 0.902), (0.232 * sx, 0.040, 0.878),
        (0.228 * sx, 0.052, 0.862),
    ], [(0.013, 0.013), (0.011, 0.011), (0.007, 0.007)], ARM[s], n=10)

    for fk, fy in enumerate((-0.030, -0.010, 0.010, 0.030)):
        rig.tube("Finger%d.%s" % (fk, s), M["skin"], [
            (0.2485 * sx, fy, 0.822), (0.2475 * sx, fy * 1.08, 0.792),
            (0.2465 * sx, fy * 1.12, 0.774),
        ], [(0.0105, 0.0105), (0.0098, 0.0098), (0.0068, 0.0068)],
            ARM[s], n=8)

# --------------------------------------------------------------------- legs
for s, sx in (("L", 1.0), ("R", -1.0)):
    rig.tube("Leg." + s, M["skin"], [
        (0.098 * sx, 0.000, 0.985), (0.104 * sx, 0.000, 0.930),
        (0.107 * sx, 0.000, 0.860), (0.108 * sx, 0.000, 0.780),
        (0.108 * sx, 0.000, 0.700), (0.108 * sx, -0.002, 0.620),
        (0.108 * sx, -0.004, 0.560), (0.108 * sx, 0.002, 0.500),
        (0.108 * sx, 0.004, 0.430), (0.108 * sx, 0.002, 0.350),
        (0.107 * sx, 0.000, 0.260), (0.107 * sx, 0.000, 0.180),
        (0.107 * sx, 0.002, 0.115),
    ], [
        (0.100, 0.098), (0.098, 0.096), (0.090, 0.090), (0.082, 0.084),
        (0.074, 0.078), (0.066, 0.070), (0.060, 0.064), (0.062, 0.068),
        (0.058, 0.062), (0.048, 0.052), (0.040, 0.043), (0.036, 0.038),
        (0.036, 0.038),
    ], LEG[s], n=16)

    rig.tube("Foot." + s, M["skin"], [
        (0.107 * sx, -0.048, 0.044), (0.107 * sx, 0.010, 0.036),
        (0.107 * sx, 0.070, 0.033), (0.107 * sx, 0.130, 0.028),
        (0.107 * sx, 0.178, 0.022),
    ], [
        (0.042, 0.038), (0.036, 0.043), (0.033, 0.046),
        (0.028, 0.043), (0.022, 0.032),
    ], LEG[s], n=14)

# ----------------------------------------------------------------- clothing
# Open-front gi jacket. The shell is lofted as an arc that leaves a V-shaped
# gap at the front, so the skin underneath is what shows through the collar.
GI = [
    (0.940, 0.176, 0.123, 0.004),
    (0.985, 0.172, 0.120, 0.003),
    (1.042, 0.162, 0.112, 0.000),
    (1.112, 0.176, 0.121, 0.000),
    (1.188, 0.196, 0.131, -0.002),
    (1.262, 0.213, 0.139, -0.004),
    (1.330, 0.221, 0.142, -0.004),
    (1.386, 0.218, 0.137, -0.002),
    (1.424, 0.196, 0.126, 0.000),
    (1.452, 0.160, 0.114, 0.002),
    (1.474, 0.128, 0.102, 0.004),
    (1.492, 0.108, 0.094, 0.006),
]


def v_gap(z):
    t = (z - 1.355) / 0.137
    return 0.0 if t <= 0.0 else min(1.0, t) * 0.95


GI_N = 20
gv, gf = [], []
for z, rx, ry, yc in GI:
    g = v_gap(z)
    a0 = math.pi / 2.0 + g
    a1 = math.pi / 2.0 + 2.0 * math.pi - g
    for i in range(GI_N + 1):
        a = a0 + (a1 - a0) * i / GI_N
        gv.append((rx * math.cos(a), yc + ry * math.sin(a), z))
for k in range(len(GI) - 1):
    a, b = k * (GI_N + 1), (k + 1) * (GI_N + 1)
    for i in range(GI_N):
        gf.append((a + i, a + i + 1, b + i + 1, b + i))
gme = bpy.data.meshes.new("Gi")
gme.from_pydata(gv, [], gf)
gme.validate()
gme.materials.append(M["gi"])
for poly in gme.polygons:
    poly.use_smooth = True
gi_ob = bpy.data.objects.new("Gi", gme)
bpy.context.collection.objects.link(gi_ob)
rig.add(gi_ob, TORSO)

# darker trim following both edges of the opening
for side, sign in (("L", 1.0), ("R", -1.0)):
    edge = []
    for z, rx, ry, yc in GI:
        g = v_gap(z) * sign
        a = math.pi / 2.0 + g
        edge.append((rx * math.cos(a), yc + ry * math.sin(a), z))
    edge = [p for p in edge if p[2] >= 1.350]
    edge.append((0.0, 0.1360, 1.355))
    rig.tube("GiTrim." + side, M["gi"], edge,
             [(0.011, 0.008)] * (len(edge) - 1) + [(0.006, 0.005)],
             TORSO, n=8, cap_start=True, cap_end=True)

for s, sx in (("L", 1.0), ("R", -1.0)):
    # short sleeve, starting at the neck to avoid a shelf at the shoulder
    rig.tube("Sleeve." + s, M["gi"], [
        (0.090 * sx, 0, 1.464), (0.128 * sx, 0, 1.452),
        (0.162 * sx, 0, 1.424), (0.180 * sx, 0, 1.400),
        (0.196 * sx, 0, 1.360), (0.210 * sx, 0, 1.310),
        (0.222 * sx, 0, 1.252), (0.229 * sx, 0, 1.212),
    ], [
        (0.036, 0.038), (0.060, 0.058), (0.082, 0.078),
        (0.095, 0.090), (0.092, 0.087), (0.083, 0.079),
        (0.072, 0.070), (0.064, 0.062),
    ], ARM[s], n=16, cap_start=False, cap_end=False)

    # trousers, tucked into the boot
    rig.tube("Pants." + s, M["gi"], [
        (0.096 * sx, 0.000, 1.012), (0.102 * sx, 0.000, 0.950),
        (0.106 * sx, 0.000, 0.870), (0.108 * sx, 0.000, 0.780),
        (0.108 * sx, 0.000, 0.690), (0.108 * sx, -0.002, 0.600),
        (0.108 * sx, -0.004, 0.545), (0.108 * sx, 0.002, 0.480),
        (0.108 * sx, 0.004, 0.400), (0.108 * sx, 0.002, 0.360),
        (0.108 * sx, 0.000, 0.315),
    ], [
        (0.115, 0.110), (0.110, 0.106), (0.100, 0.102), (0.092, 0.096),
        (0.084, 0.089), (0.077, 0.082), (0.072, 0.076), (0.074, 0.080),
        (0.068, 0.072), (0.062, 0.066), (0.058, 0.062),
    ], LEG[s], n=16, cap_start=False, cap_end=False)

    # boot shaft with a flared cuff
    rig.tube("BootShaft." + s, M["boot"], [
        (0.108 * sx, 0.002, 0.345), (0.108 * sx, 0.002, 0.318),
        (0.108 * sx, 0.000, 0.250), (0.108 * sx, 0.000, 0.180),
        (0.107 * sx, 0.002, 0.115), (0.107 * sx, 0.004, 0.062),
    ], [
        (0.072, 0.078), (0.076, 0.082), (0.060, 0.064), (0.054, 0.058),
        (0.054, 0.058), (0.056, 0.060),
    ], LEG[s], n=16, cap_start=False, cap_end=False)

    rig.tube("BootFoot." + s, M["boot"], [
        (0.107 * sx, -0.056, 0.046), (0.107 * sx, 0.010, 0.042),
        (0.107 * sx, 0.075, 0.040), (0.107 * sx, 0.140, 0.036),
        (0.107 * sx, 0.190, 0.030), (0.107 * sx, 0.216, 0.022),
    ], [
        (0.046, 0.046), (0.042, 0.052), (0.040, 0.055),
        (0.036, 0.052), (0.030, 0.046), (0.022, 0.032),
    ], LEG[s], n=14)

    rig.tube("Sole." + s, M["sole"], [
        (0.107 * sx, -0.060, 0.011), (0.107 * sx, 0.080, 0.010),
        (0.107 * sx, 0.190, 0.010), (0.107 * sx, 0.222, 0.008),
    ], [
        (0.011, 0.044), (0.010, 0.056), (0.010, 0.048), (0.009, 0.032),
    ], LEG[s], n=12)

    # forearm wraps
    rig.tube("Wrap." + s, M["wrap"], [
        (0.2455 * sx, 0, 0.966), (0.2462 * sx, 0, 0.938), (0.2468 * sx, 0, 0.910),
    ], [(0.045, 0.044), (0.047, 0.046), (0.044, 0.043)], ARM[s],
        n=14, cap_start=False, cap_end=False)

# ---------------------------------------------------------------- obi / sash
rig.tube("Sash", M["sash"], [
    (0, 0.000, 0.992), (0, 0.000, 1.016), (0, 0.000, 1.048), (0, 0.000, 1.070),
], [(0.181, 0.129), (0.186, 0.134), (0.181, 0.129), (0.172, 0.121)],
    TORSO, n=22, cap_start=False, cap_end=False)

rig.ellipse("SashKnot", M["sash"], (-0.030, 0.138, 1.016),
            (0.036, 0.020, 0.026), TORSO, n=14, rings=8)

rig.tube("SashTailA", M["sash"], [
    (-0.036, 0.140, 0.998), (-0.046, 0.146, 0.948), (-0.056, 0.143, 0.902),
], [(0.020, 0.009), (0.017, 0.008), (0.010, 0.005)], TORSO, n=10)

rig.tube("SashTailB", M["sash"], [
    (-0.014, 0.142, 1.000), (-0.006, 0.148, 0.950), (0.002, 0.145, 0.906),
], [(0.018, 0.008), (0.015, 0.007), (0.009, 0.005)], TORSO, n=10)

# -------------------------------------------------------------- finalize
body = rig.finish()
L.report(body, rig)
L.export_glb(OUT)
print("EXPORTED", OUT, os.path.getsize(OUT))

# --------------------------------------------------------------- previews
if PREVIEW:
    L.setup_preview()
    L.render_view(os.path.join(PREVIEW, "front.png"), (0.0, 3.55, 1.10), (0, 0, 0.97), 40)
    L.render_view(os.path.join(PREVIEW, "three_quarter.png"), (2.5, 2.5, 1.28), (0, 0, 0.97), 40)
    L.render_view(os.path.join(PREVIEW, "face.png"), (0.42, 0.80, 1.66), (0, 0.02, 1.63), 80)
    L.render_view(os.path.join(PREVIEW, "back.png"), (-0.9, -3.4, 1.5), (0, 0, 1.10), 40)
    print("PREVIEWS", PREVIEW)
