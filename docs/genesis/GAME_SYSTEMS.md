# Game Systems — Genesis

## Movement
- States: idle / walk / run / jump / fall / land / fly / attack.
- Speeds: walk 4, run 8, fly 12 (sprint 18), climb 5.
- Analog-ready input scaling, air control 0.35, landing recovery 0.12 s.
- Flight: `F` toggle, Space ascend, Ctrl/C descend, 60 m altitude cap.

## Combat
- Melee: 1.25 m range, frontal cone (dot ≥ 0.3), 10 damage, 0.45 s cooldown.
- Ki blast: 12 m range, 18 damage, costs 15 Ki, 16 m/s projectile.
- Attack wind-up 0.32 s locks horizontal motion.

## Transformation
- `Ascended` (T): 1.6× damage, 1.25× move/fly speed, costs 20 Ki to enter.
- While active, passive Ki regen is suspended and the form drains 6 Ki/s; at 0 Ki it collapses automatically.
- The aura ring turns gold and flares while transformed.

## Enemies
- Three archetypes with their own home, patrol loop and leash (grunt 11 m, scout 13 m, brute 12 m).
- Idle enemies patrol a slow circle; a chase that leaves the leash breaks off and returns home (sticky give-up).
- Only the living enemy closest to the player may land a strike per frame (attack token).

## Progression
- XP: melee hit 5, ki hit 8, kill 50, quest 100.
- Level-up: +10 max Ki, +15 max HP per level. Threshold 100 × level.
- Ki regen 8/s.

## World
- Ground plane at y=0, obstacles (pillars) with capsule-vs-AABB push-out.
- Camera collision pulls follow-cam in when geometry occludes.

## Enemies / Boss
- Enemy: 60 HP, 2.5 m/s chase, 8 damage / 1.2 s, respawns in 4 s.
- Boss: 300 HP, 3 m/s chase, 20 damage / 1.5 s, respawns in 30 s, 200 XP on defeat.

## Quests
- 3 sequential: "Defeat 5 enemies", "Defeat the boss", "Reach level 5".
- Each completion awards 100 XP.

## Save
- Versioned envelope (v1): level, xp, x/y/z, hp, ki. Persisted every 5 s + on unmount.
