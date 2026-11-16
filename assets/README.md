# Genesis Asset Library

All assets in this folder are **CC0 (Public Domain)** — free for personal and commercial use, no attribution required.

## Source

Downloaded from [Cinevva](https://app.cinevva.com/game-assets/free-3d-character-models) which hosts CC0 GLB files from:
- **Quaternius** (quaternius.com) — rigged humanoid characters with animations
- **Kenney** (kenney.nl) — low-poly characters and props

## Characters (`assets/characters/`)

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

These models can be loaded in the R3F scene using `useGLTF` from `@react-three/drei`:

```tsx
import { useGLTF } from "@react-three/drei";
const { scene, animations } = useGLTF("/assets/characters/Soldier_Male.glb");
```

The `AnimationMixer` can be used to play the embedded animation clips.

## Notes

- All models are CC0 — no attribution required, but crediting the creators is appreciated.
- Models are stored as GLB (binary glTF) for optimal web loading.
- The procedural character in `src/genesis/render/Fighter.tsx` remains the default until GLTF integration is wired up.
- Quaternius models use a humanoid rig compatible with animation retargeting.
- Kenney models use various rig types (skinned skeleton or node-based).
