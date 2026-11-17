# Asset Pipeline — Genesis

## Sources
- **Original characters**: `assets/source/*.py` (Blender 5.x scripts) → `public/assets/characters/*.glb`.
  - Vanguard (10,924 tris, 20 joints, 13 materials) — `vanguard.py` + `vanguard_lib.py`.
  - Rosé Saiyan (20-bone rig, 57 mesh parts) — `rose_saiyan.py`.
- **CC0 placeholders**: Quaternius + Kenney GLBs (13 models) in `public/assets/characters/`.
- **Imported rigs** (e.g. `vegeta.glb`): iClone/CC style, 374 joints, zero-duration clips.
  Bind pose is a T-pose; handled at runtime (aliases + A-pose correction + auto scale/grounding).

## Rules
- Free/CC0 or fully original assets only. No copyrighted likenesses.
- `assets/source/` holds generators; `public/assets/` holds shipped GLBs.
- `routeTree.gen.ts` is generated — never hand-edit.

## Tooling
- Blender 5.3 at `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`.
- Headless renders via `--background --python` (no desktop window).
- GLB inspection: raw JSON parse (node/three sanitisation quirks) or browser probe pages.
- `__pycache__/` and `*.blend1` are gitignored.
