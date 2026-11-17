"""
Shared helpers for the procedural character builders in this folder.

Geometry is generated from lofted elliptical cross-sections (tubes) and
ellipsoids, then skinned with analytic two-bone weights, so the result is a
smooth organic silhouette instead of a stack of primitives.
"""
import math

import bpy
from mathutils import Vector

DEG = math.pi / 180.0


# --------------------------------------------------------------- scene reset
def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.armatures,
        bpy.data.actions,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(coll):
            coll.remove(item)


# ---------------------------------------------------------------- materials
def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def material(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hexc(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = hexc(color)
    m.use_backface_culling = False
    return m


# ------------------------------------------------------------------ rigging
class Rig:
    """Humanoid armature + analytic skin weights."""

    def __init__(self, bones):
        # bones: list of (name, head, tail, parent)
        arm_data = bpy.data.armatures.new("Vanguard_Rig")
        self.obj = bpy.data.objects.new("Vanguard_Rig", arm_data)
        bpy.context.collection.objects.link(self.obj)
        bpy.context.view_layer.objects.active = self.obj
        bpy.ops.object.mode_set(mode="EDIT")
        edit = arm_data.edit_bones
        for name, head, tail, parent in bones:
            b = edit.new(name)
            b.head = Vector(head)
            b.tail = Vector(tail)
            if parent:
                b.parent = edit[parent]
            b.use_connect = False
        bpy.ops.object.mode_set(mode="OBJECT")
        self.seg = {name: (Vector(h), Vector(t)) for name, h, t, _ in bones}
        self.parts = []
        self.rigid = []

    # ------------------------------------------------------------- weighting
    def _weights(self, ob, allowed, power=3.6):
        groups = {}
        for bone in allowed:
            groups[bone] = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            self.rigid.append(bone)
        for v in ob.data.vertices:
            p = v.co
            dist = []
            for bone in allowed:
                a, b = self.seg[bone]
                ab = b - a
                denom = ab.dot(ab)
                t = 0.0 if denom < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / denom))
                dist.append(((p - (a + ab * t)).length, bone))
            dist.sort(key=lambda x: x[0])
            best = dist[:2] if len(dist) > 1 else dist
            ws = [(1.0 / (max(d, 1e-3) ** power), bone) for d, bone in best]
            total = sum(w for w, _ in ws)
            for w, bone in ws:
                groups[bone].add([v.index], w / total, "REPLACE")

    # --------------------------------------------------------------- geometry
    def add(self, ob, allowed):
        self._weights(ob, allowed)
        self.parts.append(ob)
        return ob

    def tube(self, name, material, path, radii, allowed, n=16,
             cap_start=True, cap_end=True, smooth=True):
        pts = [Vector(p) for p in path]
        tangents = []
        for i in range(len(pts)):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == len(pts) - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            if t.length < 1e-9:
                t = Vector((0.0, 0.0, 1.0))
            tangents.append(t.normalized())

        verts, faces = [], []
        # Rotation-minimizing frame: a straight-down tube (tangent == -Z) makes
        # rotation_difference(Z, t) degenerate, so walk the frame along the path
        # instead of solving each ring independently.
        t0 = tangents[0]
        ref = Vector((0.0, 1.0, 0.0)) if abs(t0.y) < 0.9 else Vector((1.0, 0.0, 0.0))
        right = ref.cross(t0)
        if right.length < 1e-6:
            right = Vector((1.0, 0.0, 0.0))
        right.normalize()
        prev_t = t0
        for p, t, r in zip(pts, tangents, radii):
            if t is not t0:
                right = prev_t.rotation_difference(t) @ right
            right = (right - t * right.dot(t))
            if right.length < 1e-6:
                right = Vector((1.0, 0.0, 0.0))
            right.normalize()
            fwd = t.cross(right)
            prev_t = t
            rx, ry = (r, r) if isinstance(r, (int, float)) else r
            for i in range(n):
                th = 2.0 * math.pi * i / n
                verts.append(tuple(
                    p + right * (rx * math.cos(th)) + fwd * (ry * math.sin(th))
                ))
        for k in range(len(pts) - 1):
            a, b = k * n, (k + 1) * n
            for i in range(n):
                j = (i + 1) % n
                faces.append((a + i, a + j, b + j, b + i))
        if cap_start:
            faces.append(tuple(reversed(range(n))))
        if cap_end:
            base = (len(pts) - 1) * n
            faces.append(tuple(base + i for i in range(n)))

        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.validate()
        me.materials.append(material)
        if smooth:
            for poly in me.polygons:
                poly.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        return self.add(ob, allowed)

    def ellipse(self, name, material, center, radius, allowed,
                n=16, rings=10, scale_y=1.0, smooth=True):
        """Ellipsoid built directly as a lat/long mesh in world space."""
        cx, cy, cz = center
        rx, ry, rz = radius
        ry *= scale_y
        verts, faces = [], []
        for j in range(1, rings):
            phi = math.pi * j / rings
            for i in range(n):
                th = 2.0 * math.pi * i / n
                verts.append((
                    cx + rx * math.sin(phi) * math.cos(th),
                    cy + ry * math.sin(phi) * math.sin(th),
                    cz + rz * math.cos(phi),
                ))
        top = len(verts)
        verts.append((cx, cy, cz + rz))
        bottom = len(verts)
        verts.append((cx, cy, cz - rz))
        for j in range(rings - 2):
            a, b = j * n, (j + 1) * n
            for i in range(n):
                k = (i + 1) % n
                faces.append((a + i, a + k, b + k, b + i))
        for i in range(n):
            k = (i + 1) % n
            faces.append((top, i, k))
            base = (rings - 2) * n
            faces.append((bottom, base + k, base + i))

        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.validate()
        me.materials.append(material)
        if smooth:
            for poly in me.polygons:
                poly.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        return self.add(ob, allowed)

    # ------------------------------------------------------------------ done
    def finish(self):
        bpy.ops.object.select_all(action="DESELECT")
        for ob in self.parts:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        body = bpy.context.object
        body.name = "Vanguard"
        body.data.name = "VanguardMesh"
        body.parent = self.obj
        mod = body.modifiers.new("Armature", "ARMATURE")
        mod.object = self.obj
        return body


# ------------------------------------------------------------------ export
def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


# ------------------------------------------------------------------ preview
def setup_preview(ground_color=(0.05, 0.05, 0.06)):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 28
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    scene.render.resolution_x = 660
    scene.render.resolution_y = 860
    scene.render.film_transparent = False
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Punchy"
    except Exception:
        pass

    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.035, 0.038, 0.05, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(material("Floor", "#22242c", 0.85))

    def area(name, loc, target, energy, size, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = Vector(loc)
        direction = Vector(target) - Vector(loc)
        light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return light

    area("Key", (2.4, 3.0, 3.2), (0, 0, 1.1), 210, 2.5, (1.0, 0.96, 0.9))
    area("Fill", (-3.0, 1.6, 1.7), (0, 0, 1.0), 60, 3.0, (0.72, 0.8, 1.0))
    area("Rim", (-1.6, -3.0, 2.4), (0, 0, 1.2), 150, 1.8, (0.8, 0.86, 1.0))
    area("Kick", (0.4, -1.2, 0.25), (0, 0, 0.9), 18, 1.0, (1.0, 0.9, 0.85))


def render_view(path, loc, target, lens=40.0):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def report(body, rig):
    me = body.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    print("VERTS", len(me.vertices), "TRIS", sum(len(p.vertices) - 2 for p in me.polygons))
    print("BONES", len(rig.obj.data.bones))
    print("BOUNDS x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f" % (
        min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
    print("MATERIALS", [m.name for m in me.materials])
    print("GROUPS", len(body.vertex_groups))


def hexcol(h):
    return hexc(h)


__all__ = [
    "reset_scene", "material", "Rig", "export_glb", "setup_preview",
    "render_view", "report", "hexc", "DEG",
]
