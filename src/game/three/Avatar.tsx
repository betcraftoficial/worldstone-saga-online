import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MOUNTS, OUTFITS, type OutfitDef, type MountDef } from "../data";

const SKIN = "#e9b98f";
const EFFECT_COLORS: Record<NonNullable<OutfitDef["effect"]>, string> = {
  gold: "#ffd65a", fire: "#ff6a1f", frost: "#9be8ff", shadow: "#22d3ee", nature: "#a3ff6b", stars: "#fff3a0",
};

export function AuraFx({ effect, height = 1.8 }: { effect: NonNullable<OutfitDef["effect"]>; height?: number }) {
  const ref = useRef<THREE.Points>(null);
  const N = 36;
  const seeds = useMemo(() => Array.from({ length: N }, () => [Math.random() * Math.PI * 2, Math.random(), 0.5 + Math.random() * 0.6]), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const arr = geo.attributes.position.array as Float32Array;
    seeds.forEach(([a, p, r], i) => {
      let x = 0, y = 0, z = 0;
      if (effect === "fire" || effect === "nature") {
        const ph = (p + t * 0.5) % 1;
        x = Math.cos(a + t) * r * 0.7; z = Math.sin(a + t) * r * 0.7; y = ph * height * 1.2;
      } else if (effect === "stars" || effect === "gold") {
        const aa = a + t * (0.8 + p);
        x = Math.cos(aa) * r; z = Math.sin(aa) * r; y = 0.3 + p * height + Math.sin(t * 2 + a) * 0.15;
      } else if (effect === "frost") {
        const aa = a + t * 0.4;
        x = Math.cos(aa) * (r + 0.2); z = Math.sin(aa) * (r + 0.2); y = 0.4 + ((p + t * 0.15) % 1) * height;
      } else {
        const ph = (p + t * 0.25) % 1;
        x = Math.cos(a) * r * (0.6 + ph); z = Math.sin(a) * r * (0.6 + ph); y = ph * 0.8;
      }
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    });
    geo.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={EFFECT_COLORS[effect]} size={effect === "shadow" ? 0.35 : 0.16} transparent opacity={effect === "shadow" ? 0.45 : 0.95} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

function Weapon({ vocation, color }: { vocation: string; color: string }) {
  if (vocation === "paladin")
    return (
      <group rotation={[0, 0, 0.1]}>
        <mesh position={[0, -0.1, 0.05]}><torusGeometry args={[0.38, 0.03, 6, 12, Math.PI]} /><meshStandardMaterial color={color} /></mesh>
      </group>
    );
  if (vocation === "druid" || vocation === "sorcerer")
    return (
      <group>
        <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.035, 0.035, 1.3, 6]} /><meshStandardMaterial color="#6b4423" /></mesh>
        <mesh position={[0, 0.5, 0]}><icosahedronGeometry args={[0.12, 0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} toneMapped={false} /></mesh>
      </group>
    );
  const len = vocation === "rogue" ? 0.45 : 0.9;
  return (
    <group rotation={[Math.PI / 2.4, 0, 0]}>
      <mesh position={[0, -0.1 - len / 2, 0]}><boxGeometry args={[0.07, len, 0.02]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.25} /></mesh>
      <mesh position={[0, -0.08, 0]}><boxGeometry args={[0.25, 0.05, 0.06]} /><meshStandardMaterial color="#8a6a2a" /></mesh>
    </group>
  );
}

export function MountMesh({ mount, moving }: { mount: MountDef; moving: () => boolean }) {
  const legs = useRef<THREE.Group[]>([]);
  const wings = useRef<THREE.Group[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mv = moving();
    legs.current.forEach((l, i) => { if (l) l.rotation.x = mv ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7 : 0; });
    wings.current.forEach((w, i) => { if (w) w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(t * (mv ? 9 : 3)) * 0.35); });
  });
  const big = mount.kind === "bear" || mount.kind === "drake";
  const bodyL = big ? 1.5 : 1.3;
  return (
    <group>
      <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[0.65, 0.55, bodyL]} /><meshStandardMaterial color={mount.color} roughness={0.7} /></mesh>
      <mesh position={[0, 1.2, bodyL / 2 + 0.15]} castShadow><boxGeometry args={[0.4, 0.4, 0.55]} /><meshStandardMaterial color={mount.color} roughness={0.7} /></mesh>
      <mesh position={[0, 1.15, bodyL / 2 + 0.47]}><boxGeometry args={[0.28, 0.22, 0.2]} /><meshStandardMaterial color={mount.color2} /></mesh>
      {mount.kind === "deer" && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.15, 1.6, bodyL / 2 + 0.1]} rotation={[0.3, 0, s * 0.5]}><coneGeometry args={[0.04, 0.6, 5]} /><meshStandardMaterial color={mount.color2} emissive={mount.color2} emissiveIntensity={1.5} toneMapped={false} /></mesh>
      ))}
      {(mount.kind === "wolf" || mount.kind === "bear") && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.13, 1.47, bodyL / 2 + 0.05]}><coneGeometry args={[0.07, 0.18, 4]} /><meshStandardMaterial color={mount.color} /></mesh>
      ))}
      {mount.kind === "drake" && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, 1.5, bodyL / 2]} rotation={[-0.6, 0, 0]}><coneGeometry args={[0.05, 0.35, 5]} /><meshStandardMaterial color={mount.color2} /></mesh>
      ))}
      <mesh position={[0, 0.95, -bodyL / 2 - 0.25]} rotation={[0.9, 0, 0]}><coneGeometry args={[0.1, 0.6, 5]} /><meshStandardMaterial color={mount.color2} /></mesh>
      {[[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]].map(([x, z], i) => (
        <group key={i} position={[x, 0.65, z * bodyL]} ref={(g) => { if (g) legs.current[i] = g; }}>
          <mesh position={[0, -0.32, 0]} castShadow><boxGeometry args={[0.16, 0.65, 0.16]} /><meshStandardMaterial color={mount.color} /></mesh>
        </group>
      ))}
      {(mount.kind === "griffin" || mount.kind === "drake") && [-1, 1].map((s, i) => (
        <group key={s} position={[s * 0.32, 1.05, 0.1]} ref={(g) => { if (g) wings.current[i] = g; }}>
          <mesh position={[s * 0.7, 0, 0]}><boxGeometry args={[1.4, 0.05, 0.8]} /><meshStandardMaterial color={mount.color2} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      {mount.effect && <AuraFx effect={mount.effect} height={1} />}
    </group>
  );
}

/** Procedural stylized adventurer. `moving` is read per frame so no React re-render is needed. */
export function Avatar({ outfit, mount, vocation, weaponColor, moving }: {
  outfit: string; mount: string | null; vocation: string; weaponColor: string; moving: () => boolean;
}) {
  const o = OUTFITS[outfit] ?? OUTFITS.aventureiro;
  const m = mount ? MOUNTS[mount] : null;
  const lLeg = useRef<THREE.Group>(null), rLeg = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null), rArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mv = moving();
    const sw = mv && !m ? Math.sin(t * 10) * 0.7 : 0;
    if (lLeg.current) lLeg.current.rotation.x = m ? -1.1 : sw;
    if (rLeg.current) rLeg.current.rotation.x = m ? -1.1 : -sw;
    if (lArm.current) lArm.current.rotation.x = -sw * 0.8;
    if (rArm.current) rArm.current.rotation.x = sw * 0.6 - 0.3;
    if (body.current) body.current.position.y = (m ? 0.95 : 0) + (mv ? Math.abs(Math.sin(t * 10)) * 0.05 : Math.sin(t * 2) * 0.015);
    if (cape.current) cape.current.rotation.x = 0.12 + (mv ? 0.35 + Math.sin(t * 8) * 0.08 : Math.sin(t * 1.5) * 0.04);
  });
  const mat = (c: string, extra?: Partial<THREE.MeshStandardMaterialParameters>) => <meshStandardMaterial color={c} roughness={0.75} {...extra} />;
  const glow = o.premium ? { emissive: o.trim, emissiveIntensity: 0.6 } : {};
  return (
    <group>
      {m && <MountMesh mount={m} moving={moving} />}
      <group ref={body}>
        <group ref={lLeg} position={[-0.14, 0.72, 0]}><mesh position={[0, -0.35, 0]} castShadow><boxGeometry args={[0.2, 0.72, 0.22]} />{mat(o.head)}</mesh></group>
        <group ref={rLeg} position={[0.14, 0.72, 0]}><mesh position={[0, -0.35, 0]} castShadow><boxGeometry args={[0.2, 0.72, 0.22]} />{mat(o.head)}</mesh></group>
        <mesh position={[0, 1.08, 0]} castShadow><boxGeometry args={[0.56, 0.72, 0.34]} />{mat(o.body)}</mesh>
        <mesh position={[0, 0.8, 0]}><boxGeometry args={[0.6, 0.1, 0.38]} />{mat(o.trim, glow)}</mesh>
        <mesh position={[0, 1.4, 0]}><boxGeometry args={[0.62, 0.1, 0.38]} />{mat(o.trim, glow)}</mesh>
        <group ref={lArm} position={[-0.37, 1.38, 0]}><mesh position={[0, -0.3, 0]} castShadow><boxGeometry args={[0.17, 0.62, 0.18]} />{mat(o.body)}</mesh></group>
        <group ref={rArm} position={[0.37, 1.38, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow><boxGeometry args={[0.17, 0.62, 0.18]} />{mat(o.body)}</mesh>
          <group position={[0, -0.6, 0.08]}><Weapon vocation={vocation} color={weaponColor} /></group>
        </group>
        <mesh position={[0, 1.72, 0]} castShadow><boxGeometry args={[0.4, 0.4, 0.38]} />{mat(SKIN)}</mesh>
        <mesh position={[0, 1.93, -0.02]}><boxGeometry args={[0.44, 0.14, 0.42]} />{mat(o.head)}</mesh>
        <mesh position={[0.1, 1.75, 0.195]}><boxGeometry args={[0.06, 0.06, 0.01]} /><meshBasicMaterial color="#1b1b1b" /></mesh>
        <mesh position={[-0.1, 1.75, 0.195]}><boxGeometry args={[0.06, 0.06, 0.01]} /><meshBasicMaterial color="#1b1b1b" /></mesh>
        {o.cape && (
          <mesh ref={cape} position={[0, 1.42, -0.2]} castShadow>
            <boxGeometry args={[0.55, 1.05, 0.04]} />
            <meshStandardMaterial color={o.cape} roughness={0.8} />
          </mesh>
        )}
      </group>
      {o.effect && <AuraFx effect={o.effect} />}
    </group>
  );
}
