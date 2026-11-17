# Genesis Asset Library

All assets in this folder are either **CC0 (Public Domain)** or **original work
generated for this project** — free for personal and commercial use, no
attribution required.

## Original characters (`public/assets/characters/`)

Built from procedural geometry by the scripts in `assets/source/`, so the meshes
are original work (no third-party likeness or scanned assets).

| File | Source script | Tris | Rig | Animations |
|------|---------------|------|-----|------------|
| vanguard.glb | `assets/source/vanguard.py` | 10,924 | Skinned (20 joints) | 0 (procedural) |
| rose_saiyan.glb | `assets/source/rose_saiyan.py` | 9,710 | Skinned (20 joints) | 0 (procedural) |

`vanguard.glb` is built by `vanguard.py` + `vanguard_lib.py`:

```
blender --background --python assets/source/vanguard.py -- \
  public/assets/characters/vanguard.glb [preview_dir]
```

The rig carries **no baked clips on purpose**. `FighterRose.tsx` drives the 20
joints from the pure pose state machine in `src/genesis/sim/animation.ts`, so
walk / run / jump / land limb motion comes from gameplay state rather than
pre-authored animation.

Joint names are stable and are what the renderer looks up:

```
root, hips, spine, chest, neck, head,
shoulder.L/R, upperArm.L/R, lowerArm.L/R, hand.L/R,
thigh.L/R, shin.L/R, foot.L/R
```

## Third-party characters (`public/assets/characters/`)

Downloaded from [Cinevva](https://app.cinevva.com/game-assets/free-3d-character-models),
which hosts CC0 GLB files from **Quaternius** (quaternius.com) and **Kenney**
(kenney.nl).

| File | Source | Tris | Rig | Animations |
|------|--------|------|-----|------------|
| Soldier_Male.glb | Quaternius | 5,542 | Skinned (23 joints) | 17 clips |
| Knight_Male.glb | Quaternius | 5,978 | Skinned (23 joints) | 17 clips |
| Casual_Female.glb | Quaternius | 6,624 | Skinned (23 joints) | 17 clips |
| Toon_Soldier.glb | Quaternius | 21,469 | Skinned | 17 clips |
| Cyberpunk_Character.glb | Quaternius | 7,778 | Skinned | 22 clips |
| Zombie_Male.glb | Quaternius | 7,650 | Skinned | 17 clips |
| Soldier_Female.glb | Quaternius | 9,716 | Skinned | 17 clips |
| Shaun.glb | Quaternius | 30,305 | Skinned | 20 clips |
| Matt.glb | Quaternius | 27,720 | Skinned | 20 clips |
| Sam.glb | Quaternius | 28,684 | Skinned | 20 clips |
| Lis.glb | Quaternius | 28,106 | Skinned | 20 clips |
| Kenney_Soldier.glb | Kenney | 889 | Skinned | 25 clips |
| Kenney_Male_A.glb | Kenney | 1,259 | Skinned | 32 clips |

## Usage in Genesis

Models are served straight from `public/` at `/assets/characters/<file>.glb` and
loaded with `fetch` + `GLTFLoader.parse` in `FighterRose.tsx` (`drei` is not a
dependency of this project):

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const buf = await (await fetch("/assets/characters/vanguard.glb")).arrayBuffer();
new GLTFLoader().parse(buf, "", (gltf) => { /* gltf.scene */ });
```

## Notes

- Models are stored as GLB (binary glTF) for optimal web loading.
- The procedural character in `src/genesis/render/Fighter.tsx` remains as a
  fallback when a model fails to load.
- Quaternius models use a humanoid rig compatible with animation retargeting.
- Kenney models use various rig types (skinned skeleton or node-based).
- Rigged GLBs from the asset library keep their baked clips; the original
  characters above are driven procedurally instead.
