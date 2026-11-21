/**
 * Rose Saiyan fighter — drives an original GLB rig (rose_saiyan.glb) with the
 * pure animation Pose state machine. Bones are rotated each frame from the
 * same angles that drive the procedural fighter, so walk/run/jump/limb motion
 * works without baked clips. Original character — no copyrighted assets.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { advancePhase, createPose, poseForInto, smoothPoseInto, type Pose } from "../sim/animation";
import { updateCharacter, type CharacterInput, type CharacterState } from "../sim/character";
import { LAND_RECOVERY } from "../sim/character";
import type { CharacterDef } from "../characters";
import type { HudStats } from "../hud/GenesisHud";
import type { RawKeys } from "./useKeyboard";
import { moveIntent, resolveCameraPosition } from "./cameraRelative";
import { resolveBones } from "./boneNames";
import { characterSpaceOffsetInto, IDENTITY_QUAT, type Quat } from "./rigAxes";
import type { GenesisCommand } from "../genesisBus";
import { OBSTACLES } from "../world";
import {
  applyDamage,
  createCombatant,
  meleeHits,
  MELEE_DAMAGE,
  spendKi,
  regenKi,
  KI_BLAST_COST,
  KI_BLAST_DAMAGE,
  KI_BLAST_RANGE,
  type Combatant,
} from "../sim/combat";
import {
  awardXp,
  createProgress,
  maxHpForLevel,
  maxKiForLevel,
  XP_PER_KI_HIT,
  XP_PER_KILL,
  XP_PER_MELEE_HIT,
  xpToNextLevel,
  type Progress,
} from "../sim/progression";
import { ENEMY_TYPES, enemySpawnY, regionAt } from "../sim/enemies";
import {
  countAliveEnemies,
  countEnemiesInRegion,
  createEnemyRoster,
  damageEnemy,
  enemyDefByID,
  killAllEnemies,
  stepEnemyRoster,
  telegraphStrength,
  type EnemyRoster,
} from "../sim/enemyRoster";
import { createEnemyBody, disposeEnemyBody, type EnemyBody } from "./enemyBody";
import { createNpcBody, disposeNpcBody, type NpcBody } from "./npcBody";
import { GENESIS_NPCS, dialogueLine, nearestNpc, nextLineIndex, npcFacingYaw } from "../sim/npcs";
import {
  BOSS_ATTACK_DAMAGE,
  BOSS_HOME,
  BOSS_MAX_HP,
  BOSS_RESPAWN,
  BOSS_SPAWN_Y,
  createBossState,
  engageBoss,
  stepBoss,
  type BossAiState,
} from "../sim/boss";
import { GENESIS_FORMS, canEnterForm, drainFormKi, formByID, formDamage } from "../sim/forms";
import { parseSave, SAVE_KEY, SAVE_VERSION, serializeSave, type GenesisSave } from "../sim/save";
import { GENESIS_QUESTS, questBaseline, questComplete, questProgress, type KillCounts } from "../sim/quests";

const CAM_BACK = 3.6;
const CAM_UP = 1.9;
const LOOK_AT_Y = 1.0;
const CHAR_RADIUS = 0.4;

/** Height every model is normalised to when its own units are clearly off. */
const TARGET_HEIGHT = 1.75;
/** Only rescale when a model is obviously not already in metres. */
const HEIGHT_RANGE = [1.35, 2.15] as const;

/**
 * Logical bone → the names real rigs use, most specific first. Our generated
 * rig uses dotted names; imported iClone-style rigs use shoulder_2/elbow/knee.
 * Note the iClone `*_upper_1`/`*_lower_1` bones are leaf helpers, not the
 * deform chain, so they are deliberately absent here.
 */
const BONE_WANTED = {
  root: ["root", "RL_BoneRoot", "root_ground"],
  hips: ["hips", "root_hips"],
  spine: ["spine", "spine_lower"],
  chest: ["chest", "spine_upper"],
  neck: ["neck", "head_neck_lower"],
  head: ["head", "head_neck_upper", "head_root"],
  upperArmL: ["upperArm.L", "arm_left_shoulder_2"],
  lowerArmL: ["lowerArm.L", "arm_left_elbow"],
  upperArmR: ["upperArm.R", "arm_right_shoulder_2"],
  lowerArmR: ["lowerArm.R", "arm_right_elbow"],
  thighL: ["thigh.L", "leg_left_thigh"],
  shinL: ["shin.L", "leg_left_knee"],
  thighR: ["thigh.R", "leg_right_thigh"],
  shinR: ["shin.R", "leg_right_knee"],
} as const;

/**
 * Aim a limb bone at a world direction, independent of the rig's local axes.
 * Used to turn a T-pose bind rig into an A-pose.
 */
function aimBone(bone: THREE.Bone, child: THREE.Bone, desiredWorld: THREE.Vector3): void {
  bone.updateWorldMatrix(true, false);
  const boneWorldQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(boneWorldQuat);
  const head = bone.getWorldPosition(new THREE.Vector3());
  const tail = child.getWorldPosition(new THREE.Vector3());
  const dir = tail.sub(head);
  if (dir.lengthSq() < 1e-9) return;
  dir.normalize();
  const axis = new THREE.Vector3().crossVectors(dir, desiredWorld);
  if (axis.lengthSq() < 1e-9) return;
  axis.normalize();
  const angle = dir.angleTo(desiredWorld);
  bone.rotateOnAxis(axis.applyQuaternion(boneWorldQuat.invert()).normalize(), angle);
}

type FighterProps = {
  stateRef: RefObject<CharacterState>;
  keysRef: RefObject<RawKeys>;
  onStats: (s: HudStats) => void;
  character: CharacterDef;
  teleportRef?: RefObject<{ x: number; y: number; z: number } | null>;
  modelUrl: string;
  commandQueueRef?: RefObject<GenesisCommand[]>;
  commandHandlerRef?: RefObject<((cmd: GenesisCommand) => void) | null>;
};

type Bones = {
  root: THREE.Bone;
  hips: THREE.Bone;
  spine: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  upperArmL: THREE.Bone;
  lowerArmL: THREE.Bone;
  upperArmR: THREE.Bone;
  lowerArmR: THREE.Bone;
  thighL: THREE.Bone;
  shinL: THREE.Bone;
  thighR: THREE.Bone;
  shinR: THREE.Bone;
};

export function FighterRose({
  stateRef,
  keysRef,
  onStats,
  character,
  teleportRef,
  modelUrl,
  commandQueueRef,
  commandHandlerRef,
}: FighterProps) {
  const { camera, scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<Bones | null>(null);
  const [loaded, setLoaded] = useState(false);
  const auraRef = useRef<THREE.Mesh>(null);

  const anim = useRef({ phase: 0, current: createPose(), target: createPose() });
  const frames = useRef({ count: 0, time: 0 });
  const wasGroundedRef = useRef(true);
  const prevFlyRef = useRef(false);
  const prevAttackRef = useRef(false);
  const targetMeshRef = useRef<THREE.Mesh | null>(null);
  const targetCombatantRef = useRef<Combatant>(createCombatant(100));
  const targetRespawnRef = useRef(0);
  const targetFlashRef = useRef(0);
  const playerCombatantRef = useRef<Combatant>(createCombatant(100, 100));
  const sparksRef = useRef<
    Array<{ mesh: THREE.Mesh; life: number; vx: number; vy: number; vz: number }>
  >([]);
  const progressRef = useRef<Progress>(createProgress());
  const enemyBodiesRef = useRef<EnemyBody[]>([]);
  const enemiesRef = useRef<EnemyRoster>(createEnemyRoster());
  const enemyFlashRef = useRef<number[]>([]);
  const enemyLungeRef = useRef<number[]>([]);
  const enemyAnimTimeRef = useRef(0);
  const npcBodiesRef = useRef<NpcBody[]>([]);
  // -1 = nothing said yet, so the first E press shows the first line.
  const npcLineRef = useRef(-1);
  const npcTalkTimerRef = useRef(0);
  const prevInteractRef = useRef(false);
  const formIDRef = useRef<string | null>(null);
  const prevTransformRef = useRef(false);
  const playerRespawnRef = useRef(0);
  const bossWasAliveRef = useRef(false);
  const bossMeshRef = useRef<THREE.Mesh | null>(null);
  const bossCombatantRef = useRef<Combatant>(createCombatant(BOSS_MAX_HP));
  const bossAiRef = useRef<BossAiState>(createBossState());
  const bossRespawnRef = useRef(BOSS_RESPAWN);
  const bossFlashRef = useRef(0);
  const questIndexRef = useRef(0);
  // Enemy and boss defeats are counted separately: one shared counter let an
  // ordinary kill complete the "Defeat the boss" quest.
  const killCountRef = useRef<KillCounts>({ enemy: 0, boss: 0 });
  const questBaseRef = useRef<KillCounts>({ enemy: 0, boss: 0 });
  const projectilesRef = useRef<Array<{ mesh: THREE.Mesh; vx: number; vz: number; life: number }>>(
    [],
  );
  const prevKiRef = useRef(false);
  // Rest rotations captured at load so we can offset from the bind pose.
  const restRef = useRef<Record<string, THREE.Quaternion> | null>(null);
  // For imported rigs: each bone's rest orientation relative to the character
  // root, used to apply pose angles in character space (see rigAxes.ts).
  const rigWorldRef = useRef<Record<string, Quat> | null>(null);
  const rigOffset = useRef<Quat>({ ...IDENTITY_QUAT }).current;
  const tmpEuler = useRef(new THREE.Euler()).current;
  const tmpQuat = useRef(new THREE.Quaternion()).current;

  // Load-order flags are primitives, so they can safely be effect dependencies
  // without re-fetching on every render.
  const { tPose = false, modelYaw = 0, rigAxes = false } = character;

  useEffect(() => {
    const target = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 6, 12),
      new THREE.MeshStandardMaterial({ color: "#e05252", roughness: 0.7 }),
    );
    target.position.set(3, 0.9, 0);
    target.castShadow = true;
    scene.add(target);
    targetMeshRef.current = target;
    return () => {
      scene.remove(target);
      target.geometry.dispose();
      (target.material as THREE.Material).dispose();
      targetMeshRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    // One procedural body per archetype; roster rules only supply positions.
    const bodies: EnemyBody[] = [];
    for (const def of ENEMY_TYPES) {
      const body = createEnemyBody(def);
      body.group.position.set(def.home.x, enemySpawnY(def), def.home.z);
      scene.add(body.group);
      bodies.push(body);
    }
    enemyBodiesRef.current = bodies;
    enemyFlashRef.current = ENEMY_TYPES.map(() => 0);
    enemyLungeRef.current = ENEMY_TYPES.map(() => 0);
    enemyAnimTimeRef.current = 0;
    return () => {
      for (const body of bodies) {
        scene.remove(body.group);
        disposeEnemyBody(body);
      }
      enemyBodiesRef.current = [];
      enemyFlashRef.current = [];
      enemyLungeRef.current = [];
    };
  }, [scene]);

  useEffect(() => {
    // One procedural body per NPC; the sim module only supplies placement.
    const bodies: NpcBody[] = [];
    for (const def of GENESIS_NPCS) {
      const body = createNpcBody(def);
      body.group.position.set(def.x, 0, def.z);
      body.group.rotation.y = def.yaw;
      scene.add(body.group);
      bodies.push(body);
    }
    npcBodiesRef.current = bodies;
    npcLineRef.current = -1;
    npcTalkTimerRef.current = 0;
    return () => {
      for (const body of bodies) {
        scene.remove(body.group);
        disposeNpcBody(body);
      }
      npcBodiesRef.current = [];
    };
  }, [scene]);

  useEffect(() => {
    const boss = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.4, 6, 12),
      new THREE.MeshStandardMaterial({
        color: "#c0392b",
        roughness: 0.6,
        emissive: "#7f1d1d",
        emissiveIntensity: 0.3,
      }),
    );
    boss.position.set(BOSS_HOME.x, BOSS_SPAWN_Y, BOSS_HOME.z);
    boss.castShadow = true;
    boss.visible = false;
    scene.add(boss);
    bossMeshRef.current = boss;
    return () => {
      scene.remove(boss);
      boss.geometry.dispose();
      (boss.material as THREE.Material).dispose();
      bossMeshRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    rigWorldRef.current = null;
    let cancelled = false;
    fetch(modelUrl)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const loader = new GLTFLoader();
        loader.parse(
          buf,
          "",
          (gltf) => {
            if (cancelled) return;
            const scene = gltf.scene;
            group.add(scene);
            let skinned: THREE.SkinnedMesh | null = null;
            scene.traverse((o) => {
              if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = o as THREE.SkinnedMesh;
            });
            const skeleton = skinned ? (skinned as THREE.SkinnedMesh).skeleton : null;
            // three.js sanitises node names on load (dots are stripped), so match
            // on the normalised name instead of the authored one.
            const available: string[] = skeleton
              ? skeleton.bones.map((b) => b.name)
              : (() => {
                  const names: string[] = [];
                  scene.traverse((o) => {
                    if ((o as THREE.Bone).isBone) names.push(o.name);
                  });
                  return names;
                })();
            const resolved = resolveBones(available, BONE_WANTED);
            const boneByName = new Map<string, THREE.Bone>();
            if (skeleton) {
              for (const b of skeleton.bones) boneByName.set(b.name, b);
            } else {
              scene.traverse((o) => {
                if ((o as THREE.Bone).isBone) boneByName.set(o.name, o as THREE.Bone);
              });
            }
            const bones: Bones | null = resolved
              ? (Object.fromEntries(
                  Object.entries(resolved).map(([key, name]) => [
                    key,
                    boneByName.get(name) ?? null,
                  ]),
                ) as Bones)
              : null;
            const bonesComplete = bones && Object.values(bones).every((b) => b !== null);
            if (!bonesComplete) {
              console.warn(
                "FighterRose: rig bones not found in",
                modelUrl,
                "- available:",
                available.slice(0, 24),
              );
            }

            if (bonesComplete && tPose) {
              // Bind pose has arms out; drop them to a relaxed A-pose so the
              // procedural gait (which assumes arms at the sides) reads right.
              scene.updateMatrixWorld(true);
              aimBone(
                bones!.upperArmL,
                bones!.lowerArmL,
                new THREE.Vector3(0.34, -1, 0.06).normalize(),
              );
              aimBone(
                bones!.upperArmR,
                bones!.lowerArmR,
                new THREE.Vector3(-0.34, -1, 0.06).normalize(),
              );
              scene.updateMatrixWorld(true);
            }

            if (modelYaw) scene.rotation.y = modelYaw;

            // Normalise size and put the feet on the floor. Imported rigs bake
            // their own lift (e.g. +0.577) and centimetre scale into the armature,
            // which made them hover and read as tiny.
            scene.updateMatrixWorld(true);
            const rawBox = new THREE.Box3().setFromObject(scene);
            const rawHeight = rawBox.max.y - rawBox.min.y;
            if (Number.isFinite(rawHeight) && rawHeight > 0.05) {
              const [minH, maxH] = HEIGHT_RANGE;
              if (rawHeight < minH || rawHeight > maxH) {
                scene.scale.multiplyScalar(TARGET_HEIGHT / rawHeight);
              }
            }
            scene.updateMatrixWorld(true);
            const sizedBox = new THREE.Box3().setFromObject(scene);
            if (Number.isFinite(sizedBox.min.y)) scene.position.y -= sizedBox.min.y;

            bonesRef.current = bonesComplete ? bones : null;
            const rest: Record<string, THREE.Quaternion> = {};
            if (bonesComplete && bones) {
              for (const [k, v] of Object.entries(bones)) rest[k] = v.quaternion.clone();
            }
            restRef.current = rest;

            // Capture each bone's rest orientation in character space (relative
            // to the group, so the facing yaw is excluded and the model yaw is
            // included). Imported rigs need this to rotate about character axes.
            const worldAxes: Record<string, Quat> = {};
            if (bonesComplete && bones && rigAxes) {
              scene.updateMatrixWorld(true);
              const groupQuat = new THREE.Quaternion();
              if (groupRef.current) groupRef.current.getWorldQuaternion(groupQuat);
              groupQuat.invert();
              const boneQuat = new THREE.Quaternion();
              for (const [key, bone] of Object.entries(bones)) {
                bone.getWorldQuaternion(boneQuat);
                boneQuat.premultiply(groupQuat);
                worldAxes[key] = {
                  x: boneQuat.x,
                  y: boneQuat.y,
                  z: boneQuat.z,
                  w: boneQuat.w,
                };
              }
            }
            rigWorldRef.current = rigAxes && Object.keys(worldAxes).length > 0 ? worldAxes : null;
            setLoaded(true);
          },
          (err) => console.error("Rose GLTF parse error:", err),
        );
      })
      .catch((err) => console.error("Rose GLTF fetch error:", err));
    return () => {
      cancelled = true;
      while (group.children.length > 0) {
        const c = group.children[0];
        if (c) group.remove(c);
        else break;
      }
    };
  }, [modelUrl, tPose, modelYaw, rigAxes]);

  useEffect(() => {
    // Load saved progress.
    try {
      const save = parseSave(window.localStorage.getItem(SAVE_KEY));
      if (save) {
        progressRef.current = { level: save.level, xp: save.xp };
        const c = createCombatant(maxHpForLevel(save.level), maxKiForLevel(save.level));
        playerCombatantRef.current = { ...c, hp: save.hp, ki: save.ki };
        if (teleportRef) teleportRef.current = { x: save.x, y: save.y, z: save.z };
      }
    } catch {
      // Ignore storage errors.
    }

    const persist = () => {
      try {
        const st = stateRef.current;
        const save: GenesisSave = {
          version: SAVE_VERSION,
          level: progressRef.current.level,
          xp: progressRef.current.xp,
          x: st.x,
          y: st.y,
          z: st.z,
          hp: playerCombatantRef.current.hp,
          ki: playerCombatantRef.current.ki,
        };
        window.localStorage.setItem(SAVE_KEY, serializeSave(save));
      } catch {
        // Ignore storage errors.
      }
    };

    const id = window.setInterval(persist, 5000);
    return () => {
      clearInterval(id);
      persist();
    };
  }, []);

  /** Toggle the first transformation (T key or God Engine command). */
  const toggleForm = () => {
    if (formIDRef.current) {
      formIDRef.current = null;
      return;
    }
    const attempt = canEnterForm(
      GENESIS_FORMS[0],
      progressRef.current.level,
      playerCombatantRef.current.ki,
    );
    if (attempt.ok) {
      formIDRef.current = attempt.form.id;
      playerCombatantRef.current = { ...playerCombatantRef.current, ki: attempt.ki };
    }
  };

  const applyCommand = (cmd: GenesisCommand) => {
    switch (cmd.type) {
      case "transform":
        toggleForm();
        break;
      case "heal":
        playerCombatantRef.current = createCombatant(
          maxHpForLevel(progressRef.current.level),
          maxKiForLevel(progressRef.current.level),
        );
        break;
      case "giveXp":
        {
          const r = awardXp(progressRef.current, cmd.amount);
          progressRef.current = r.progress;
        }
        break;
      case "killEnemies": {
        const result = killAllEnemies(enemiesRef.current);
        enemiesRef.current = result.roster;
        killCountRef.current.enemy += result.killed;
        break;
      }
      case "spawnBoss":
        bossCombatantRef.current = createCombatant(BOSS_MAX_HP);
        bossRespawnRef.current = 0;
        bossFlashRef.current = 0;
        bossWasAliveRef.current = true;
        bossAiRef.current = engageBoss(createBossState());
        if (bossMeshRef.current) {
          bossMeshRef.current.visible = true;
          bossMeshRef.current.position.set(BOSS_HOME.x, BOSS_SPAWN_Y, BOSS_HOME.z);
        }
        break;
      case "reset":
        progressRef.current = createProgress();
        playerCombatantRef.current = createCombatant(100, 100);
        targetCombatantRef.current = createCombatant(100);
        formIDRef.current = null;
        killCountRef.current = { enemy: 0, boss: 0 };
        questIndexRef.current = 0;
        questBaseRef.current = questBaseline(GENESIS_QUESTS[0]!, killCountRef.current);
        enemiesRef.current = createEnemyRoster();
        bossCombatantRef.current = createCombatant(BOSS_MAX_HP);
        bossAiRef.current = createBossState();
        bossRespawnRef.current = BOSS_RESPAWN;
        bossFlashRef.current = 0;
        bossWasAliveRef.current = false;
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!commandHandlerRef) return;
    commandHandlerRef.current = applyCommand;
    return () => {
      commandHandlerRef.current = null;
    };
  }, [commandHandlerRef]);

  const spawnSparks = (pos: THREE.Vector3, color: string) => {
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      m.position.copy(pos);
      scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const up = 1 + Math.random() * 2;
      sparksRef.current.push({
        mesh: m,
        life: 0.4,
        vx: Math.cos(a) * (1 + Math.random()),
        vy: up,
        vz: Math.sin(a) * (1 + Math.random()),
      });
    }
  };

  useFrame((_, delta) => {
    const tp = teleportRef?.current;
    if (tp) {
      stateRef.current = { ...stateRef.current, x: tp.x, y: tp.y, z: tp.z, vx: 0, vy: 0, vz: 0 };
      teleportRef.current = null;
    }
    // Drain God Engine commands targeted at the fighter.
    const q = commandQueueRef?.current;
    if (q && q.length) {
      for (const cmd of q) applyCommand(cmd);
      q.length = 0;
    }
    const keys = keysRef.current;
    const move = moveIntent(keys, camera);

    // Transformation (T): pay the Ki cost, hold the form while Ki lasts, and
    // skip passive regeneration until it collapses.
    const transformEdge = keys.transform && !prevTransformRef.current;
    prevTransformRef.current = keys.transform;
    if (transformEdge) toggleForm();
    const activeForm = formByID(formIDRef.current);
    if (activeForm) {
      const drain = drainFormKi(activeForm, playerCombatantRef.current.ki, delta);
      playerCombatantRef.current = { ...playerCombatantRef.current, ki: drain.ki };
      if (!drain.active) formIDRef.current = null;
    } else {
      playerCombatantRef.current = regenKi(playerCombatantRef.current, 8 * delta);
    }
    // Re-read after the drain so a collapse takes effect the same frame.
    const attackForm = formByID(formIDRef.current);

    const flyEdge = keys.fly && !prevFlyRef.current;
    prevFlyRef.current = keys.fly;
    const attackEdge = keys.attack && !prevAttackRef.current;
    prevAttackRef.current = keys.attack;
    const kiEdge = keys.ki && !prevKiRef.current;
    prevKiRef.current = keys.ki;
    const input: CharacterInput = {
      moveX: move.moveX,
      moveZ: move.moveZ,
      sprint: keys.sprint,
      jump: keys.jump,
      toggleFly: flyEdge,
      ascend: stateRef.current.flying && keys.jump,
      descend: keys.descend,
      attack: attackEdge,
      speedMult: attackForm ? attackForm.speedMult : 1,
    };
    const next = updateCharacter(stateRef.current, input, delta);
    const speed = Math.hypot(next.vx, next.vz);

    // collision
    let rx = next.x,
      rz = next.z;
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      for (const ob of OBSTACLES) {
        // Flying characters clear pillars shorter than their altitude.
        if (next.y >= ob.h) continue;
        const hw = ob.w / 2,
          hd = ob.d / 2;
        const cx = Math.max(ob.x - hw, Math.min(rx, ob.x + hw));
        const cz = Math.max(ob.z - hd, Math.min(rz, ob.z + hd));
        const dx = rx - cx,
          dz = rz - cz,
          dist = Math.hypot(dx, dz);
        if (dist < CHAR_RADIUS && dist > 1e-6) {
          const p = (CHAR_RADIUS - dist) / dist;
          rx += dx * p;
          rz += dz * p;
          pushed = true;
        } else if (dist <= 1e-6) {
          const l = rx - (ob.x - hw),
            r = ob.x + hw - rx,
            b = rz - (ob.z - hd),
            f = ob.z + hd - rz;
          const m = Math.min(l, r, b, f);
          if (m === l) rx = ob.x - hw - CHAR_RADIUS;
          else if (m === r) rx = ob.x + hw + CHAR_RADIUS;
          else if (m === b) rz = ob.z - hd - CHAR_RADIUS;
          else rz = ob.z + hd + CHAR_RADIUS;
          pushed = true;
        }
      }
      if (!pushed) break;
    }

    let action = next.action,
      landTimer = next.landTimer,
      vy = next.vy;
    const grounded = next.grounded;
    if (grounded && !wasGroundedRef.current) {
      action = "land";
      landTimer = LAND_RECOVERY;
      vy = 0;
    }
    if (grounded && vy < 0) vy = 0;
    wasGroundedRef.current = grounded;

    const resolved = { x: rx, y: next.y, z: rz };
    stateRef.current = {
      ...next,
      x: resolved.x,
      y: resolved.y,
      z: resolved.z,
      action,
      landTimer,
      vy,
      grounded,
    };

    if (groupRef.current) {
      groupRef.current.position.set(resolved.x, resolved.y, resolved.z);
      groupRef.current.rotation.y = next.facing;
    }

    // Target dummy: melee hit detection + respawn.
    const targetMesh = targetMeshRef.current;
    const bossMesh = bossMeshRef.current;
    if (attackEdge) {
      const attacker = { x: resolved.x, z: resolved.z, facing: next.facing };
      if (targetMesh && targetCombatantRef.current.alive) {
        const tpos = targetMesh.position;
        if (meleeHits(attacker, { x: tpos.x, z: tpos.z })) {
          const wasAlive = targetCombatantRef.current.alive;
          targetCombatantRef.current = applyDamage(
            targetCombatantRef.current,
            formDamage(MELEE_DAMAGE, attackForm),
          );
          targetFlashRef.current = 0.2;
          spawnSparks(targetMesh.position, "#ffaa33");
          const xpAmt =
            !targetCombatantRef.current.alive && wasAlive ? XP_PER_KILL : XP_PER_MELEE_HIT;
          const r = awardXp(progressRef.current, xpAmt);
          progressRef.current = r.progress;
        }
      }
      for (const enemy of enemiesRef.current) {
        if (!enemy.alive) continue;
        const def = enemyDefByID(enemy.typeId);
        if (!def || !meleeHits(attacker, enemy)) continue;
        const result = damageEnemy(
          enemiesRef.current,
          enemy.typeId,
          formDamage(MELEE_DAMAGE, attackForm),
        );
        enemiesRef.current = result.roster;
        enemyFlashRef.current[ENEMY_TYPES.indexOf(def)] = 0.2;
        spawnSparks(new THREE.Vector3(enemy.x, enemySpawnY(def), enemy.z), "#ffaa33");
        if (result.killed) killCountRef.current.enemy += 1;
        const r = awardXp(progressRef.current, result.killed ? def.xp : XP_PER_MELEE_HIT);
        progressRef.current = r.progress;
      }
      if (bossMesh && bossCombatantRef.current.alive) {
        const bpos = bossMesh.position;
        if (meleeHits(attacker, { x: bpos.x, z: bpos.z })) {
          const wasAlive = bossCombatantRef.current.alive;
          bossCombatantRef.current = applyDamage(
            bossCombatantRef.current,
            formDamage(MELEE_DAMAGE * 2, attackForm),
          );
          bossFlashRef.current = 0.2;
          spawnSparks(bossMesh.position, "#ff5533");
          const xpAmt = !bossCombatantRef.current.alive && wasAlive ? 200 : XP_PER_MELEE_HIT * 2;
          const r = awardXp(progressRef.current, xpAmt);
          progressRef.current = r.progress;
        }
      }
    }
    if (!targetCombatantRef.current.alive) {
      targetRespawnRef.current += delta;
      if (targetMesh) targetMesh.visible = false;
      if (targetRespawnRef.current >= 3) {
        targetCombatantRef.current = createCombatant(100);
        targetRespawnRef.current = 0;
        if (targetMesh) {
          targetMesh.visible = true;
          targetMesh.position.set(3, 0.9, 0);
        }
      }
    } else {
      targetRespawnRef.current = 0;
      if (targetMesh) targetMesh.visible = true;
    }
    // Flash decay.
    if (targetFlashRef.current > 0) {
      targetFlashRef.current = Math.max(0, targetFlashRef.current - delta);
      const scale = 1 + 0.35 * (targetFlashRef.current / 0.2);
      if (targetMesh) targetMesh.scale.setScalar(scale);
    } else if (targetMesh) {
      targetMesh.scale.setScalar(1);
    }

    // Ki blast.
    if (kiEdge) {
      const spent = spendKi(playerCombatantRef.current, KI_BLAST_COST);
      if (spent) {
        playerCombatantRef.current = spent;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 12, 12),
          new THREE.MeshBasicMaterial({ color: "#7fd6ff" }),
        );
        mesh.position.set(resolved.x, resolved.y + 1.0, resolved.z);
        scene.add(mesh);
        const dir = { x: Math.sin(next.facing), z: Math.cos(next.facing) };
        projectilesRef.current.push({ mesh, vx: dir.x * 16, vz: dir.z * 16, life: 2 });
      }
    }
    // Update projectiles.
    const projs = projectilesRef.current;
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]!;
      p.mesh.position.x += p.vx * delta;
      p.mesh.position.z += p.vz * delta;
      p.life -= delta;
      let remove = p.life <= 0;
      const targetMesh = targetMeshRef.current;
      if (!remove && targetMesh && targetMesh.visible && targetCombatantRef.current.alive) {
        const d = Math.hypot(
          p.mesh.position.x - targetMesh.position.x,
          p.mesh.position.z - targetMesh.position.z,
        );
        if (d < 0.6) {
          const wasAlive = targetCombatantRef.current.alive;
          targetCombatantRef.current = applyDamage(
            targetCombatantRef.current,
            formDamage(KI_BLAST_DAMAGE, attackForm),
          );
          targetFlashRef.current = 0.2;
          spawnSparks(targetMesh.position, "#7fd6ff");
          const r1 = awardXp(progressRef.current, XP_PER_KI_HIT);
          progressRef.current = r1.progress;
          if (!targetCombatantRef.current.alive && wasAlive) {
            const r2 = awardXp(progressRef.current, XP_PER_KILL);
            progressRef.current = r2.progress;
          }
          remove = true;
        }
      }
      if (!remove && bossMesh && bossMesh.visible && bossCombatantRef.current.alive) {
        const d = Math.hypot(
          p.mesh.position.x - bossMesh.position.x,
          p.mesh.position.z - bossMesh.position.z,
        );
        if (d < 0.8) {
          const wasAlive = bossCombatantRef.current.alive;
          bossCombatantRef.current = applyDamage(
            bossCombatantRef.current,
            formDamage(KI_BLAST_DAMAGE * 2, attackForm),
          );
          bossFlashRef.current = 0.2;
          spawnSparks(bossMesh.position, "#7fd6ff");
          const r1 = awardXp(progressRef.current, XP_PER_KI_HIT * 2);
          progressRef.current = r1.progress;
          if (!bossCombatantRef.current.alive && wasAlive) {
            const r2 = awardXp(progressRef.current, 200);
            progressRef.current = r2.progress;
          }
          remove = true;
        }
      }
      if (!remove) {
        for (const enemy of enemiesRef.current) {
          if (!enemy.alive) continue;
          const def = enemyDefByID(enemy.typeId);
          if (!def) continue;
          const d = Math.hypot(p.mesh.position.x - enemy.x, p.mesh.position.z - enemy.z);
          if (d >= def.radius + 0.3) continue;
          const result = damageEnemy(
            enemiesRef.current,
            enemy.typeId,
            formDamage(KI_BLAST_DAMAGE, attackForm),
          );
          enemiesRef.current = result.roster;
          enemyFlashRef.current[ENEMY_TYPES.indexOf(def)] = 0.2;
          spawnSparks(new THREE.Vector3(enemy.x, enemySpawnY(def), enemy.z), "#7fd6ff");
          if (result.killed) killCountRef.current.enemy += 1;
          const r = awardXp(progressRef.current, result.killed ? def.xp : XP_PER_KI_HIT);
          progressRef.current = r.progress;
          remove = true;
          break;
        }
      }
      if (remove) {
        scene.remove(p.mesh);
        (p.mesh.geometry as THREE.BufferGeometry).dispose();
        (p.mesh.material as THREE.Material).dispose();
        projs.splice(i, 1);
      }
    }

    // Keep player resources scaled to level.
    playerCombatantRef.current = {
      ...playerCombatantRef.current,
      maxKi: maxKiForLevel(progressRef.current.level),
      maxHp: maxHpForLevel(progressRef.current.level),
    };

    // Enemy roster AI: every archetype keeps its own position, attack cooldown
    // and respawn timer. Rules live in sim/enemyRoster.ts; this only mirrors
    // the returned state onto the meshes.
    const enemyStep = stepEnemyRoster(
      enemiesRef.current,
      { x: resolved.x, z: resolved.z, alive: playerCombatantRef.current.alive },
      delta,
    );
    enemiesRef.current = enemyStep.roster;
    for (const attack of enemyStep.attacks) {
      const index = ENEMY_TYPES.findIndex((def) => def.id === attack.typeId);
      if (index >= 0) enemyLungeRef.current[index] = 0.22;
      if (!playerCombatantRef.current.alive) break;
      playerCombatantRef.current = applyDamage(playerCombatantRef.current, attack.damage);
    }
    enemyAnimTimeRef.current += delta;
    const enemyTime = enemyAnimTimeRef.current;
    const enemyBodies = enemyBodiesRef.current;
    for (let i = 0; i < enemiesRef.current.length; i++) {
      const enemy = enemiesRef.current[i];
      const body = enemyBodies[i];
      if (!enemy || !body) continue;
      body.group.visible = enemy.alive;
      const def = enemyDefByID(enemy.typeId);
      if (!enemy.alive || !def) {
        enemyFlashRef.current[i] = 0;
        enemyLungeRef.current[i] = 0;
        continue;
      }
      const angle = Math.atan2(resolved.x - enemy.x, resolved.z - enemy.z);
      // Idle enemies look along their patrol loop instead of staring at the
      // player from across the arena.
      const facing =
        enemy.mode === "chase"
          ? angle
          : Math.atan2(
              def.home.x + Math.sin(enemy.patrolPhase) * def.patrolRadius - enemy.x,
              def.home.z + Math.cos(enemy.patrolPhase) * def.patrolRadius - enemy.z,
            );
      const flash = enemyFlashRef.current[i] ?? 0;
      if (flash > 0) enemyFlashRef.current[i] = Math.max(0, flash - delta);
      const lunge = Math.max(0, (enemyLungeRef.current[i] ?? 0) - delta);
      enemyLungeRef.current[i] = lunge;
      const bob = Math.sin(enemyTime * 2.2 + i * 1.7) * 0.03;
      const push = (lunge / 0.22) * 0.2;
      body.group.position.set(
        enemy.x + Math.sin(angle) * push,
        enemySpawnY(def) + bob,
        enemy.z + Math.cos(angle) * push,
      );
      body.group.rotation.y = facing;
      // Telegraph: lean in and pulse the chest core during the last moments of
      // the cooldown, but only while the enemy is actually chasing.
      const telegraph = enemy.mode === "chase" ? telegraphStrength(enemy.cooldown) : 0;
      body.group.rotation.x = telegraph * 0.14;
      body.coreMaterial.emissiveIntensity =
        0.35 + telegraph * 1.6 + (flash > 0 ? 2.2 * (flash / 0.2) : 0);
      body.group.scale.setScalar(1 + 0.3 * (flash / 0.2));
      if (body.eliteRingMaterial) {
        body.eliteRingMaterial.emissiveIntensity =
          0.45 + 0.25 * Math.sin(enemyTime * 2.4 + i);
      }
    }

    // NPC proximity and dialogue. Range/cycling rules are pure (sim/npcs.ts).
    const near = nearestNpc({ x: resolved.x, z: resolved.z });
    const interactEdge = keys.interact && !prevInteractRef.current;
    prevInteractRef.current = keys.interact;
    if (interactEdge && near) {
      npcLineRef.current = nextLineIndex(npcLineRef.current, near.npc.lines.length);
      npcTalkTimerRef.current = 5;
    }
    npcTalkTimerRef.current = Math.max(0, npcTalkTimerRef.current - delta);
    const npcTime = enemyTime;
    for (let i = 0; i < npcBodiesRef.current.length; i++) {
      const body = npcBodiesRef.current[i];
      const def = GENESIS_NPCS[i];
      if (!body || !def) continue;
      const close = near?.npc.id === def.id;
      body.group.rotation.y = npcFacingYaw(def, close ? resolved : null);
      body.ringMaterial.emissiveIntensity = close ? 0.7 + Math.sin(npcTime * 3) * 0.3 : 0.2;
    }

    if (bossWasAliveRef.current && !bossCombatantRef.current.alive) {
      killCountRef.current.boss += 1;
      bossWasAliveRef.current = false;
    }

    // Boss AI. Dormant until the player enters its aggro radius; leashes home
    // instead of following the player into the second region.
    if (bossMesh) {
      if (!bossCombatantRef.current.alive) {
        bossRespawnRef.current += delta;
        bossMesh.visible = false;
        if (bossRespawnRef.current >= BOSS_RESPAWN) {
          bossCombatantRef.current = createCombatant(BOSS_MAX_HP);
          bossAiRef.current = createBossState();
          bossRespawnRef.current = 0;
          bossMesh.visible = true;
          bossMesh.position.set(BOSS_HOME.x, BOSS_SPAWN_Y, BOSS_HOME.z);
          bossWasAliveRef.current = true;
        }
      } else {
        bossRespawnRef.current = 0;
        bossMesh.visible = true;
        const tick = stepBoss(
          bossAiRef.current,
          { x: resolved.x, z: resolved.z, alive: playerCombatantRef.current.alive },
          delta,
        );
        bossAiRef.current = {
          x: tick.x,
          z: tick.z,
          cooldown: tick.cooldown,
          mode: tick.mode,
        };
        bossMesh.position.set(tick.x, BOSS_SPAWN_Y, tick.z);
        if (tick.mode === "chase") {
          bossMesh.rotation.y = Math.atan2(resolved.x - tick.x, resolved.z - tick.z);
        }
        if (tick.attack && playerCombatantRef.current.alive) {
          playerCombatantRef.current = applyDamage(
            playerCombatantRef.current,
            BOSS_ATTACK_DAMAGE,
          );
        }
      }
    }

    // Boss hit flash: briefly scale the boss; the target dummy keeps its own.
    bossFlashRef.current = Math.max(0, bossFlashRef.current - delta);
    if (bossMesh) bossMesh.scale.setScalar(1 + 0.25 * (bossFlashRef.current / 0.2));

    // Player death / respawn.
    if (!playerCombatantRef.current.alive) {
      playerRespawnRef.current += delta;
      if (playerRespawnRef.current >= 3) {
        playerCombatantRef.current = createCombatant(
          maxHpForLevel(progressRef.current.level),
          maxKiForLevel(progressRef.current.level),
        );
        playerRespawnRef.current = 0;
        // A transformation does not survive death.
        formIDRef.current = null;
        // Reset position via teleportRef.
        if (teleportRef) teleportRef.current = { x: 0, y: 0, z: 0 };
      }
    } else {
      playerRespawnRef.current = 0;
    }

    // Pose from the pure animation system.
    const a = anim.current;
    a.phase = advancePhase(a.phase, action, speed, delta);
    poseForInto(a.target, action, speed, a.phase);
    smoothPoseInto(a.current, a.current, a.target, 1 - Math.exp(-delta * 16));
    const pose: Pose = a.current;

    const bones = bonesRef.current;
    const rest = restRef.current;
    const rigWorld = rigWorldRef.current;
    if (bones && rest) {
      const set = (key: keyof Bones, x: number, y = 0, z = 0) => {
        const b = bones[key];
        const r = rest[key];
        if (!b || !r) return;
        if (rigWorld) {
          // Imported rig: convert the character-space angles into the bone's
          // local frame, then compose on top of the captured rest pose.
          const w0 = rigWorld[key];
          if (!w0) return;
          characterSpaceOffsetInto(rigOffset, w0, x, y, z);
          tmpQuat.set(rigOffset.x, rigOffset.y, rigOffset.z, rigOffset.w);
        } else {
          // Generated rig: bone axes already align with character axes.
          tmpEuler.set(x, y, z);
          tmpQuat.setFromEuler(tmpEuler);
        }
        // Compose the offset on top of the captured rest pose, so any load-time
        // correction (e.g. lowering a T-pose's arms) is preserved.
        b.quaternion.copy(r).multiply(tmpQuat);
      };
      // Legs swing opposite; knees only bend forward.
      set("thighL", -pose.hipL, 0, 0);
      set("thighR", -pose.hipR, 0, 0);
      set("shinL", pose.kneeL, 0, 0);
      set("shinR", pose.kneeR, 0, 0);
      // Arms counter-swing; elbows bend.
      set("upperArmL", -pose.shoulderL, 0, -pose.armSpread);
      set("upperArmR", -pose.shoulderR, 0, pose.armSpread);
      set("lowerArmL", -pose.elbowL, 0, 0);
      set("lowerArmR", -pose.elbowR, 0, 0);
      // Torso lean/roll, head yaw, hips bob.
      set("spine", -pose.torsoPitch, 0, pose.torsoRoll);
      set("chest", -pose.torsoPitch * 0.5, 0, 0);
      set("head", 0, pose.headYaw, 0);
    }
    // Hip bob moves the whole fighter rather than a rig-specific root bone,
    // which keeps it correct for rigs whose root sits under a scaled armature.
    const bob = pose.hipsY;
    if (groupRef.current) groupRef.current.position.y = resolved.y + bob;

    // Aura pulses with speed; a transformation recolours it and adds a flare.
    if (auraRef.current) {
      const form = formByID(formIDRef.current);
      const t = Math.min(1, speed / 8);
      const mat = auraRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(form ? form.aura : "#e0508c");
      mat.opacity = 0.18 + 0.4 * t + (form ? 0.22 : 0);
      const s = (1 + 0.15 * t) * (form ? 1.18 : 1);
      auraRef.current.scale.set(s, 1, s);
      auraRef.current.rotation.z += delta * (0.8 + 3 * t);
    }

    // Camera
    const desiredCam = { x: resolved.x, y: resolved.y + CAM_UP, z: resolved.z + CAM_BACK };
    const lookAt = { x: resolved.x, y: resolved.y + LOOK_AT_Y, z: resolved.z };
    const dx2 = desiredCam.x - lookAt.x,
      dy2 = desiredCam.y - lookAt.y,
      dz2 = desiredCam.z - lookAt.z;
    const dist = Math.hypot(dx2, dy2, dz2);
    let hitToi: number | null = null;
    if (dist > 0) {
      const dir = { x: dx2 / dist, y: dy2 / dist, z: dz2 / dist };
      let best = Infinity;
      for (const ob of OBSTACLES) {
        const t = rayAABB(lookAt, dir, {
          min: { x: ob.x - ob.w / 2, y: 0, z: ob.z - ob.d / 2 },
          max: { x: ob.x + ob.w / 2, y: ob.h, z: ob.z + ob.d / 2 },
        });
        if (t !== null && t < best) best = t;
      }
      if (best !== Infinity && best < dist) hitToi = best / dist;
    }
    const camPos = resolveCameraPosition(lookAt, desiredCam, hitToi, 0.82);
    const camTarget = new THREE.Vector3(camPos.x, camPos.y, camPos.z);
    camera.position.lerp(camTarget, 1 - Math.exp(-delta * 6));
    camera.lookAt(lookAt.x, lookAt.y, lookAt.z);

    // Update hit sparks.
    const sparks = sparksRef.current;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i]!;
      sp.mesh.position.x += sp.vx * delta;
      sp.mesh.position.y += sp.vy * delta;
      sp.mesh.position.z += sp.vz * delta;
      sp.vy -= 9.8 * delta;
      sp.life -= delta;
      const mat = sp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, sp.life / 0.4);
      if (sp.life <= 0) {
        scene.remove(sp.mesh);
        (sp.mesh.geometry as THREE.BufferGeometry).dispose();
        mat.dispose();
        sparks.splice(i, 1);
      }
    }

    const acc = frames.current;
    // Quest progression: each quest reads only the counter it targets, measured
    // from the moment that quest became active.
    const quest = GENESIS_QUESTS[questIndexRef.current];
    if (
      quest &&
      questComplete(quest, progressRef.current.level, killCountRef.current, questBaseRef.current)
    ) {
      const r = awardXp(progressRef.current, 100);
      progressRef.current = r.progress;
      questIndexRef.current = Math.min(questIndexRef.current + 1, GENESIS_QUESTS.length);
      // Snapshot the new quest's counter baseline, so kills from the previous
      // quest never carry over into it.
      const nextQuest = GENESIS_QUESTS[questIndexRef.current];
      if (nextQuest) questBaseRef.current = questBaseline(nextQuest, killCountRef.current);
    }
    const activeQuest = GENESIS_QUESTS[questIndexRef.current];
    const questText = activeQuest
      ? `${activeQuest.name} (${Math.min(
          activeQuest.target,
          questProgress(
            activeQuest,
            progressRef.current.level,
            killCountRef.current,
            questBaseRef.current,
          ),
        )}/${activeQuest.target})`
      : "All quests complete!";
    const region = regionAt(resolved);
    const regionEnemies = countEnemiesInRegion(enemiesRef.current, region.id);
    acc.count += 1;
    acc.time += delta;
    if (acc.time >= 0.5) {
      onStats({
        fps: Math.round(acc.count / acc.time),
        ms: (acc.time / acc.count) * 1000,
        action,
        speed,
        character: character.name,
        targetHp: targetCombatantRef.current.hp,
        bossHp: bossCombatantRef.current.hp,
        enemiesAlive: countAliveEnemies(enemiesRef.current),
        enemiesTotal: enemiesRef.current.length,
        region: region.name,
        regionSubtitle: region.subtitle,
        regionEnemiesAlive: regionEnemies.alive,
        regionEnemiesTotal: regionEnemies.total,
        ki: playerCombatantRef.current.ki,
        maxKi: playerCombatantRef.current.maxKi,
        hp: playerCombatantRef.current.hp,
        maxHp: playerCombatantRef.current.maxHp,
        level: progressRef.current.level,
        xp: progressRef.current.xp,
        xpToNext: xpToNextLevel(progressRef.current.level),
        quest: questText,
        ...(near ? { npcName: near.npc.name } : {}),
        ...(npcTalkTimerRef.current > 0 && near
          ? { npcDialogue: dialogueLine(near.npc, npcLineRef.current) }
          : {}),
        ...(formByID(formIDRef.current) ? { form: formByID(formIDRef.current)!.name } : {}),
      });
      acc.count = 0;
      acc.time = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={auraRef} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.9, 40]} />
        <meshBasicMaterial
          color="#e0508c"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {!loaded && (
        <mesh position={[0, 0.9, 0]}>
          <capsuleGeometry args={[0.3, 0.7, 8, 12]} />
          <meshStandardMaterial color="#232a4a" />
        </mesh>
      )}
    </group>
  );
}

function rayAABB(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
): number | null {
  let tmin = -Infinity,
    tmax = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis],
      d = dir[axis],
      lo = box.min[axis],
      hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d,
        t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}
