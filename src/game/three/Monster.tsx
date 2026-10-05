import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { R } from "../engine";
import { heightAt } from "../world";

export function MonsterView({ idx }: { idx: number }) {
  const m = R.monsters[idx];
  const g = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group[]>([]);
  const wings = useRef<THREE.Group[]>([]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const d = m.def;
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.visible = m.alive;
    g.current.position.set(m.x, heightAt(m.x, m.z), m.z);
    g.current.rotation.y = m.ry;
    const sw = m.moving ? Math.sin(t * 9 + idx) * 0.6 : 0;
    legs.current.forEach((l, i) => { if (l) l.rotation.x = i % 2 ? sw : -sw; });
    wings.current.forEach((w, i) => { if (w) w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * 4 + idx) * 0.4); });
    if (mat.current) {
      const flash = performance.now() / 1000 - m.hitFlash < 0.12;
      mat.current.emissive.set(flash ? "#ffffff" : d.boss ? d.color2 : "#000000");
      mat.current.emissiveIntensity = flash ? 0.8 : d.boss ? 0.25 : 0;
    }
  });
  const onDown = (e: { stopPropagation: () => void }) => { e.stopPropagation(); R.target = { kind: "monster", idx }; };
  const s = d.scale;
  const body = <meshStandardMaterial ref={mat} color={d.color} roughness={0.75} flatShading />;
  const acc = <meshStandardMaterial color={d.color2} roughness={0.6} />;
  return (
    <group ref={g} onPointerDown={onDown}>
      <group scale={s}>
        {d.shape === "quad" && (
          <>
            <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[0.7, 0.6, 1.3]} />{body}</mesh>
            <mesh position={[0, 1.05, 0.8]} castShadow><boxGeometry args={[0.5, 0.45, 0.55]} />{body}</mesh>
            <mesh position={[0, 0.95, 1.12]}><boxGeometry args={[0.3, 0.2, 0.25]} />{acc}</mesh>
            {[-1, 1].map((x) => <mesh key={x} position={[x * 0.14, 1.36, 0.72]}><coneGeometry args={[0.08, 0.22, 4]} />{body}</mesh>)}
            <mesh position={[0, 0.9, -0.8]} rotation-x={0.9}><coneGeometry args={[0.1, 0.6, 5]} />{acc}</mesh>
            {[[-0.25, 0.45], [0.25, 0.45], [-0.25, -0.45], [0.25, -0.45]].map(([x, z], i) => (
              <group key={i} position={[x, 0.55, z]} ref={(r) => { if (r) legs.current[i] = r; }}>
                <mesh position={[0, -0.27, 0]}><boxGeometry args={[0.16, 0.55, 0.16]} />{body}</mesh>
              </group>
            ))}
          </>
        )}
        {d.shape === "biped" && (
          <>
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.17, 0.75, 0]} ref={(r) => { if (r) legs.current[i] = r; }}>
                <mesh position={[0, -0.36, 0]} castShadow><boxGeometry args={[0.24, 0.74, 0.26]} />{acc}</mesh>
              </group>
            ))}
            <mesh position={[0, 1.15, 0]} castShadow><boxGeometry args={[0.7, 0.8, 0.42]} />{body}</mesh>
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.47, 1.45, 0]} ref={(r) => { if (r) legs.current[i + 2] = r; }}>
                <mesh position={[0, -0.35, 0]} castShadow><boxGeometry args={[0.2, 0.72, 0.22]} />{body}</mesh>
              </group>
            ))}
            <mesh position={[0, 1.85, 0.02]} castShadow><boxGeometry args={[0.48, 0.48, 0.44]} />{body}</mesh>
            {[-1, 1].map((x) => (
              <mesh key={x} position={[x * 0.11, 1.9, 0.23]}><boxGeometry args={[0.08, 0.06, 0.02]} /><meshStandardMaterial color={d.color2} emissive={d.color2} emissiveIntensity={3} toneMapped={false} /></mesh>
            ))}
            {d.boss && <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.22, 0.28, 0.2, 6]} /><meshStandardMaterial color="#facc15" metalness={0.9} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.6} /></mesh>}
          </>
        )}
        {d.shape === "insect" && (
          <>
            <mesh position={[0, 0.5, 0]} castShadow><sphereGeometry args={[0.55, 8, 6]} />{body}</mesh>
            <mesh position={[0, 0.5, 0.65]}><sphereGeometry args={[0.3, 8, 6]} />{body}</mesh>
            {[-1, 1].map((x) => <mesh key={x} position={[x * 0.12, 0.6, 0.92]}><sphereGeometry args={[0.06]} /><meshStandardMaterial color={d.color2} emissive={d.color2} emissiveIntensity={3} toneMapped={false} /></mesh>)}
            <mesh position={[0, 1.2, -0.55]} rotation-x={-0.7}><coneGeometry args={[0.1, 0.8, 5]} />{acc}</mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const x = i % 2 ? 1 : -1; const z = (Math.floor(i / 2) - 1) * 0.35;
              return (
                <group key={i} position={[x * 0.45, 0.45, z]} ref={(r) => { if (r) legs.current[i] = r; }}>
                  <mesh position={[x * 0.25, -0.15, 0]} rotation-z={x * 0.8}><boxGeometry args={[0.6, 0.07, 0.07]} />{acc}</mesh>
                </group>
              );
            })}
          </>
        )}
        {d.shape === "dragon" && (
          <>
            <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[0.9, 0.8, 1.8]} />{body}</mesh>
            <mesh position={[0, 1.7, 1.15]} rotation-x={-0.5}><boxGeometry args={[0.45, 0.45, 0.9]} />{body}</mesh>
            <mesh position={[0, 1.95, 1.65]} castShadow><boxGeometry args={[0.55, 0.45, 0.7]} />{body}</mesh>
            {[-1, 1].map((x) => <mesh key={x} position={[x * 0.17, 2.3, 1.45]} rotation-x={-0.7}><coneGeometry args={[0.07, 0.45, 5]} />{acc}</mesh>)}
            {[-1, 1].map((x) => <mesh key={x} position={[x * 0.15, 2.05, 2.0]}><sphereGeometry args={[0.06]} /><meshStandardMaterial color="#ffe14a" emissive="#ffb000" emissiveIntensity={4} toneMapped={false} /></mesh>)}
            <mesh position={[0, 1.0, -1.4]} rotation-x={1.2}><coneGeometry args={[0.25, 1.6, 5]} />{body}</mesh>
            {[[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]].map(([x, z], i) => (
              <group key={i} position={[x, 0.75, z]} ref={(r) => { if (r) legs.current[i] = r; }}>
                <mesh position={[0, -0.35, 0]}><boxGeometry args={[0.25, 0.75, 0.3]} />{body}</mesh>
              </group>
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.45, 1.5, 0.2]} ref={(r) => { if (r) wings.current[i] = r; }}>
                <mesh position={[x * 1.1, 0, 0]}><boxGeometry args={[2.2, 0.06, 1.3]} /><meshStandardMaterial color={d.color2} side={THREE.DoubleSide} /></mesh>
              </group>
            ))}
          </>
        )}
        {d.shape === "blob" && <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.6, 10, 8]} />{body}</mesh>}
        <mesh visible={false} position={[0, 1, 0]}><boxGeometry args={[1.6, 2.2, 1.6]} /></mesh>
      </group>
    </group>
  );
}
