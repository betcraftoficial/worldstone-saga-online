import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CITIES, WORLD_SIZE, ZONES, type NpcDef } from "../data";
import { BUILDINGS, LANDMARKS, PROPS, groundColor, heightAt, type Prop } from "../world";
import { Avatar } from "./Avatar";
import { R } from "../engine";
import { useUI } from "../store";

function Terrain() {
  const geo = useMemo(() => {
    const size = WORLD_SIZE * 2;
    const seg = 220;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const [r, gg, b] = groundColor(x, z);
      colors[i * 3] = r; colors[i * 3 + 1] = gg; colors[i * 3 + 2] = b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh
      geometry={geo}
      receiveShadow
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        R.moveTarget = { x: e.point.x, z: e.point.z };
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.95} flatShading />
    </mesh>
  );
}

function Water() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#152e38" roughness={0.28} metalness={0.2} />
    </mesh>
  );
}

function Instanced({ items, children, place }: { items: unknown[]; children: React.ReactNode; place: (i: number, m: THREE.Object3D) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < items.length; i++) { place(i, o); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix); }
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [items, place]);
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>{children}</instancedMesh>;
}

function PropLayer({ kind, parts }: { kind: Prop["kind"]; parts: { geo: React.ReactNode; color: string; y: number; sy?: number; emissive?: boolean }[] }) {
  const items = useMemo(() => PROPS.filter((p) => p.kind === kind), [kind]);
  return (
    <>
      {parts.map((part, pi) => (
        <Instanced key={pi} items={items} place={(i, o) => {
          const p = items[i];
          o.position.set(p.x, heightAt(p.x, p.z) + part.y * p.s, p.z);
          o.rotation.set(0, p.r, 0);
          o.scale.setScalar(p.s);
        }}>
          {part.geo}
          <meshStandardMaterial color={part.color} roughness={0.85} flatShading emissive={part.emissive ? part.color : "#000"} emissiveIntensity={part.emissive ? 2 : 0} toneMapped={!part.emissive} />
        </Instanced>
      ))}
    </>
  );
}

function Vegetation() {
  return (
    <>
      <PropLayer kind="tree" parts={[
        { geo: <cylinderGeometry args={[0.25, 0.35, 2, 6]} />, color: "#6b4a2b", y: 1 },
        { geo: <icosahedronGeometry args={[1.6, 0]} />, color: "#3f8a3a", y: 3 },
      ]} />
      <PropLayer kind="pine" parts={[
        { geo: <cylinderGeometry args={[0.2, 0.3, 1.6, 5]} />, color: "#5a3e25", y: 0.8 },
        { geo: <coneGeometry args={[1.5, 3.6, 6]} />, color: "#2a5a3a", y: 3.2 },
      ]} />
      <PropLayer kind="palm" parts={[
        { geo: <cylinderGeometry args={[0.18, 0.28, 4, 6]} />, color: "#8a6a3e", y: 2 },
        { geo: <coneGeometry args={[2, 0.9, 7]} />, color: "#4f9a3a", y: 4.2 },
      ]} />
      <PropLayer kind="cactus" parts={[
        { geo: <cylinderGeometry args={[0.32, 0.38, 2.4, 7]} />, color: "#5d8f3e", y: 1.2 },
        { geo: <boxGeometry args={[1.5, 0.3, 0.3]} />, color: "#5d8f3e", y: 1.4 },
      ]} />
      <PropLayer kind="rock" parts={[{ geo: <dodecahedronGeometry args={[1, 0]} />, color: "#7c7a78", y: 0.4 }]} />
      <PropLayer kind="deadtree" parts={[
        { geo: <cylinderGeometry args={[0.15, 0.3, 3, 5]} />, color: "#3d2f28", y: 1.5 },
        { geo: <boxGeometry args={[1.6, 0.12, 0.12]} />, color: "#3d2f28", y: 2.4 },
      ]} />
      <PropLayer kind="crystal" parts={[{ geo: <octahedronGeometry args={[0.6, 0]} />, color: "#5ad1ff", y: 0.8, emissive: true }]} />
    </>
  );
}

function Buildings() {
  const place = useMemo(() => ({
    walls: (i: number, o: THREE.Object3D) => { const b = BUILDINGS[i]; o.position.set(b.x, b.h / 2, b.z); o.rotation.set(0, b.rot, 0); o.scale.set(b.w, b.h, b.d); },
    roofs: (i: number, o: THREE.Object3D) => { const b = BUILDINGS[i]; o.position.set(b.x, b.h + 1.2, b.z); o.rotation.set(0, b.rot + Math.PI / 4, 0); o.scale.set(b.w * 0.78, 2.4, b.d * 0.78); },
  }), []);
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    BUILDINGS.forEach((b, i) => {
      wallRef.current?.setColorAt(i, c.set(b.wall));
      roofRef.current?.setColorAt(i, c.set(b.roof));
    });
    if (wallRef.current?.instanceColor) wallRef.current.instanceColor.needsUpdate = true;
    if (roofRef.current?.instanceColor) roofRef.current.instanceColor.needsUpdate = true;
  }, []);
  const o = new THREE.Object3D();
  const setup = (ref: React.RefObject<THREE.InstancedMesh | null>, fn: (i: number, o: THREE.Object3D) => void) => (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    (ref as React.MutableRefObject<THREE.InstancedMesh | null>).current = m;
    BUILDINGS.forEach((_, i) => { fn(i, o); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  };
  return (
    <>
      <instancedMesh ref={setup(wallRef, place.walls)} args={[undefined, undefined, BUILDINGS.length]} castShadow receiveShadow>
        <boxGeometry /><meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={setup(roofRef, place.roofs)} args={[undefined, undefined, BUILDINGS.length]} castShadow>
        <coneGeometry args={[0.75, 1, 4]} /><meshStandardMaterial roughness={0.7} flatShading />
      </instancedMesh>
    </>
  );
}

function CityDecor() {
  return (
    <>
      {CITIES.map((c) => (
        <group key={c.id} position={[c.x, 0, c.z]}>
          {/* fountain / plaza */}
          <mesh position={[0, 0.25, 0]} receiveShadow><cylinderGeometry args={[3, 3.3, 0.5, 16]} /><meshStandardMaterial color="#b8b0a2" /></mesh>
          <mesh position={[0, 0.52, 0]}><cylinderGeometry args={[2.6, 2.6, 0.08, 16]} /><meshStandardMaterial color="#4fb3e8" emissive="#2a8fc8" emissiveIntensity={0.4} roughness={0.1} /></mesh>
          <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[0.3, 0.45, 2, 8]} /><meshStandardMaterial color="#cfc6b5" /></mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 9, 0, Math.sin(a) * 9]}>
                <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.08, 0.1, 2.4, 6]} /><meshStandardMaterial color="#3a2e24" /></mesh>
                <mesh position={[0, 2.5, 0]}><boxGeometry args={[0.3, 0.35, 0.3]} /><meshStandardMaterial color="#ffc46b" emissive="#ffa63d" emissiveIntensity={3} toneMapped={false} /></mesh>
              </group>
            );
          })}
          {c.npcs.map((n) => <Npc key={n.id} npc={n} />)}
        </group>
      ))}
    </>
  );
}

function Torch({ x, z, y = 2.7 }: { x: number; z: number; y?: number }) {
  return (
    <group position={[x, heightAt(x, z), z]}>
      <mesh position={[0, y / 2, 0]} castShadow><cylinderGeometry args={[0.08, 0.11, y, 6]} /><meshStandardMaterial color="#30231d" /></mesh>
      <mesh position={[0, y + 0.15, 0]}><octahedronGeometry args={[0.22, 0]} /><meshStandardMaterial color="#e9873e" emissive="#e9873e" emissiveIntensity={3.5} toneMapped={false} /></mesh>
      <pointLight position={[0, y, 0]} color="#e7a05d" intensity={5} distance={10} decay={2} />
    </group>
  );
}

function Landmarks() {
  return (
    <>
      {LANDMARKS.map((l) => {
        const y = heightAt(l.x, l.z);
        if (l.kind === "bridge") return (
          <group key={l.id} position={[l.x, y + 0.8, l.z]} rotation-y={l.rot} scale={l.scale}>
            <mesh receiveShadow castShadow><boxGeometry args={[4.6, 0.45, 13]} /><meshStandardMaterial color="#59483a" roughness={0.95} /></mesh>
            {[-1, 1].map((side) => <group key={side} position={[side * 2.1, 1, 0]}>
              <mesh castShadow><boxGeometry args={[0.22, 1.6, 13]} /><meshStandardMaterial color="#2d2825" /></mesh>
              {[-5, -2.5, 0, 2.5, 5].map((z) => <mesh key={z} position={[0, -0.4, z]} castShadow><boxGeometry args={[0.35, 2.2, 0.35]} /><meshStandardMaterial color="#312925" /></mesh>)}
            </group>)}
          </group>
        );
        if (l.kind === "ruin") return (
          <group key={l.id} position={[l.x, y, l.z]} rotation-y={l.rot} scale={l.scale}>
            {[-5, 0, 5].map((x, i) => <mesh key={x} position={[x, 1.5 + i * 0.35, i === 1 ? -4 : 0]} castShadow receiveShadow><boxGeometry args={[3.2, 3 + i * 0.7, 1]} /><meshStandardMaterial color={i === 1 ? "#5e5b55" : "#484843"} roughness={1} /></mesh>)}
            {[[-4, 3], [2, 4], [5, -2]].map(([x, z], i) => <mesh key={i} position={[x, 0.35, z]} rotation={[0.2, i, 0.1]}><dodecahedronGeometry args={[1.2, 0]} /><meshStandardMaterial color="#3b3b38" /></mesh>)}
          </group>
        );
        if (l.kind === "sewer") return (
          <group key={l.id} position={[l.x, y + 0.04, l.z]}>
            <mesh rotation-x={-Math.PI / 2}><cylinderGeometry args={[1.5, 1.5, 0.15, 20]} /><meshStandardMaterial color="#292d2b" metalness={0.65} roughness={0.5} /></mesh>
            {Array.from({ length: 8 }).map((_, i) => <mesh key={i} rotation-y={(i / 8) * Math.PI} position={[Math.cos((i / 8) * Math.PI * 2) * 1, 0.12, Math.sin((i / 8) * Math.PI * 2) * 1]}><boxGeometry args={[0.12, 0.08, 2.4]} /><meshStandardMaterial color="#151817" metalness={0.7} /></mesh>)}
          </group>
        );
        return (
          <group key={l.id} position={[l.x, y, l.z]} rotation-y={l.rot} scale={l.scale}>
            <mesh position={[0, 2.1, 0]} castShadow><torusGeometry args={[2.1, 0.7, 6, 12, Math.PI]} /><meshStandardMaterial color="#30302f" roughness={1} /></mesh>
            <mesh position={[0, 0.4, -1.2]} rotation-x={-Math.PI / 2}><circleGeometry args={[2, 16]} /><meshStandardMaterial color="#151716" roughness={1} /></mesh>
            <pointLight position={[0, 1.4, -0.5]} color={l.kind === "secret" ? "#608b73" : "#7b97a6"} intensity={7} distance={12} />
          </group>
        );
      })}
      <Torch x={18} z={21} />
      <Torch x={72} z={82} />
      <Torch x={-48} z={93} />
      <Torch x={-128} z={-115} />
    </>
  );
}

const NPC_OUTFIT: Record<NpcDef["role"], string> = { shop: "nomade", bank: "nobre", quest: "marinheiro", outfit: "cacador", temple: "aventureiro" };
function Npc({ npc }: { npc: NpcDef }) {
  const openNpc = useUI((s) => s.openNpc);
  const city = CITIES.find((c) => c.npcs.includes(npc))!;
  return (
    <group
      position={[npc.dx, 0, npc.dz]}
      rotation-y={Math.atan2(-npc.dx, -npc.dz)}
      onPointerDown={(e) => {
        e.stopPropagation();
        const wx = city.x + npc.dx, wz = city.z + npc.dz;
        if (Math.hypot(wx - R.x, wz - R.z) > 6) { R.moveTarget = { x: wx, z: wz + 1.5 }; R.log(`Aproxime-se de ${npc.name}.`); return; }
        openNpc(npc);
      }}
    >
      <Avatar outfit={NPC_OUTFIT[npc.role]} mount={null} vocation="knight" weaponColor="#ccc" moving={() => false} />
      <mesh position={[0, 2.7, 0]}><octahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color={npc.color} emissive={npc.color} emissiveIntensity={2.5} toneMapped={false} /></mesh>
      <mesh visible={false} position={[0, 1, 0]}><boxGeometry args={[1.2, 2.4, 1.2]} /></mesh>
    </group>
  );
}

function ZoneDecor() {
  return (
    <>
      {ZONES.map((z) => (
        <group key={z.id} position={[z.x, 0, z.z]}>
          {z.kind === "pvp" ? (
            <>
              {Array.from({ length: 20 }).map((_, i) => {
                const a = (i / 20) * Math.PI * 2;
                return <mesh key={i} position={[Math.cos(a) * z.radius, 2, Math.sin(a) * z.radius]} rotation-y={-a} castShadow><boxGeometry args={[1.5, 4, 9]} /><meshStandardMaterial color="#8a6e5a" roughness={0.9} /></mesh>;
              })}
              {[0, 1, 2, 3].map((i) => {
                const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
                return (
                  <group key={i} position={[Math.cos(a) * (z.radius - 4), 0, Math.sin(a) * (z.radius - 4)]}>
                    <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.1, 0.1, 6]} /><meshStandardMaterial color="#3a2e24" /></mesh>
                    <mesh position={[0.6, 5.3, 0]}><boxGeometry args={[1.2, 0.8, 0.05]} /><meshStandardMaterial color="#b3261e" emissive="#b3261e" emissiveIntensity={0.5} /></mesh>
                  </group>
                );
              })}
            </>
          ) : (
            <>
              {Array.from({ length: 14 }).map((_, i) => {
                const a = (i / 14) * Math.PI * 2;
                return <mesh key={i} position={[Math.cos(a) * z.radius, 1.6, Math.sin(a) * z.radius]} rotation={[0.3, a, 0.2]} castShadow><dodecahedronGeometry args={[3, 0]} /><meshStandardMaterial color={z.kind === "danger" ? "#4a2a22" : "#3b3533"} flatShading /></mesh>;
              })}
              <pointLight position={[0, 4, 0]} color={z.kind === "danger" ? "#ff5a2a" : "#5ad1ff"} intensity={30} distance={30} />
            </>
          )}
        </group>
      ))}
    </>
  );
}

export function World() {
  return (
    <>
      <Terrain />
      <Water />
      <Vegetation />
      <Buildings />
      <CityDecor />
      <Landmarks />
      <ZoneDecor />
    </>
  );
}
