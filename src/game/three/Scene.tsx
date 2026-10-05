import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ITEMS, VOCATIONS, regionOf } from "../data";
import { R, interpolateMonsters, simulateMonsters, tickPlayer, targetPos } from "../engine";
import { joinRegion, myState } from "../net";
import { heightAt } from "../world";
import { Avatar } from "./Avatar";
import { MonsterView } from "./Monster";
import { World } from "./World";
import { useUI } from "../store";

function weaponColor(eq: Record<string, string> | undefined) {
  return (eq?.weapon && ITEMS[eq.weapon]?.color) || "#ccc";
}

function Player() {
  const g = useRef<THREE.Group>(null);
  const me = useUI((s) => s.me);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    tickPlayer(dt);
    if (g.current) {
      g.current.position.set(R.x, heightAt(R.x, R.z), R.z);
      const dy = R.ry - g.current.rotation.y;
      g.current.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * (1 - Math.exp(-14 * dt));
      g.current.visible = !R.dead;
    }
  });
  if (!me) return null;
  return (
    <group ref={g}>
      <Avatar outfit={me.outfit} mount={me.mount} vocation={me.vocation} weaponColor={weaponColor(me.equipment)} moving={() => R.moving} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.55, 0.7, 24]} />
        <meshBasicMaterial color={VOCATIONS[me.vocation].color} transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RemoteView({ id }: { id: string }) {
  const g = useRef<THREE.Group>(null);
  const r = R.remotes.get(id);
  const [look, setLook] = useState({ outfit: r?.outfit ?? "aventureiro", mount: r?.mount ?? null, voc: r?.voc ?? "knight" });
  useFrame((_, raw) => {
    const rr = R.remotes.get(id);
    if (!rr || !g.current) return;
    const dt = Math.min(raw, 0.05);
    const k = 1 - Math.exp(-11 * dt);
    if (Math.hypot(rr.tx - rr.x, rr.tz - rr.z) > 10) { rr.x = rr.tx; rr.z = rr.tz; }
    rr.x += (rr.tx - rr.x) * k; rr.z += (rr.tz - rr.z) * k;
    const dy = rr.tr - rr.ry; rr.ry += Math.atan2(Math.sin(dy), Math.cos(dy)) * k;
    g.current.position.set(rr.x, heightAt(rr.x, rr.z), rr.z);
    g.current.rotation.y = rr.ry;
    if (rr.outfit !== look.outfit || rr.mount !== look.mount) setLook({ outfit: rr.outfit, mount: rr.mount, voc: rr.voc });
  });
  return (
    <group ref={g} onPointerDown={(e) => { e.stopPropagation(); R.target = { kind: "player", id }; }}>
      <Avatar outfit={look.outfit} mount={look.mount} vocation={look.voc} weaponColor="#ddd" moving={() => !!R.remotes.get(id)?.moving} />
      <mesh visible={false} position={[0, 1, 0]}><boxGeometry args={[1.2, 2.4, 1.2]} /></mesh>
    </group>
  );
}

function Crowd() {
  const [remotes, setRemotes] = useState<string[]>([]);
  const [mons, setMons] = useState<number[]>([]);
  useEffect(() => {
    const t = setInterval(() => {
      const ids = [...R.remotes.keys()].sort();
      setRemotes((p) => (p.join() === ids.join() ? p : ids));
      const near = R.monsters.filter((m) => Math.hypot(m.x - R.x, m.z - R.z) < 60 && (m.alive || m.region === R.region)).map((m) => m.idx);
      setMons((p) => (p.join() === near.join() ? p : near));
    }, 400);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {remotes.map((id) => <RemoteView key={id} id={id} />)}
      {mons.map((i) => <MonsterView key={i} idx={i} />)}
    </>
  );
}

function NetSync() {
  const acc = useRef({ st: 0, mon: 0, full: 0, last: "", lastAt: 0 });
  useFrame(({ clock }, raw) => {
    if (!R.me) return;
    const dt = Math.min(raw, 0.05);
    const reg = regionOf(R.x, R.z);
    if (reg !== R.region) joinRegion(reg);
    const a = acc.current;
    a.st += dt; a.mon += dt; a.full += dt;
    if (a.st >= 1 / 6) {
      a.st = 0;
      const s = myState();
      const key = `${s.x},${s.z},${s.r},${s.h},${s.mv},${s.o},${s.m},${s.s},${s.l}`;
      if (key !== a.last || clock.elapsedTime - a.lastAt > 1) {
        a.last = key; a.lastAt = clock.elapsedTime;
        R.send("st", s);
      }
    }
    if (R.coordinator) {
      const doSnap = a.mon >= 0.25;
      const full = a.full >= 2;
      simulateMonsters(dt, (rows) => { if (doSnap || full) R.send("mon", { s: rows }); }, full);
      if (doSnap) a.mon = 0;
      if (full) a.full = 0;
    } else {
      interpolateMonsters(dt);
    }
  });
  return null;
}

function CameraRig() {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const z = R.camZoom;
    const y = heightAt(R.x, R.z);
    const target = new THREE.Vector3(R.x, y + 1, R.z);
    look.current.lerp(target, 1 - Math.exp(-10 * dt));
    camera.position.set(look.current.x, look.current.y + 15 * z, look.current.z + 11 * z);
    camera.lookAt(look.current);
  });
  return null;
}

function SunFollow() {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    if (!light.current) return;
    light.current.position.set(R.x + 25, 40, R.z + 15);
    light.current.target.position.set(R.x, 0, R.z);
    light.current.target.updateMatrixWorld();
  });
  return (
    <directionalLight ref={light} intensity={1.7} color="#ffe3b8" castShadow
      shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-bias={-0.0005} />
  );
}

function TargetMarker() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const p = targetPos(R.target);
    if (!ref.current) return;
    ref.current.visible = !!p;
    if (p) {
      ref.current.position.set(p.x, heightAt(p.x, p.z) + 0.06, p.z);
      ref.current.rotation.z = clock.elapsedTime * 1.5;
      const s = R.target?.kind === "monster" ? R.monsters[R.target.idx].def.scale * 1.3 : 1;
      ref.current.scale.setScalar(Math.max(1, s));
    }
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.8, 1, 6]} />
      <meshBasicMaterial color="#ff3b30" transparent opacity={0.85} toneMapped={false} />
    </mesh>
  );
}

function MoveMarker() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = !!R.moveTarget;
    if (R.moveTarget) {
      ref.current.position.set(R.moveTarget.x, heightAt(R.moveTarget.x, R.moveTarget.z) + 0.08, R.moveTarget.z);
      ref.current.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 8) * 0.15);
    }
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2}><ringGeometry args={[0.3, 0.45, 16]} /><meshBasicMaterial color="#ffe08a" toneMapped={false} /></mesh>
  );
}

const POOL = 32;
function Effects() {
  const spheres = useRef<THREE.Mesh[]>([]);
  const rings = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const t = performance.now() / 1000;
    R.effects = R.effects.filter((e) => t - e.t0 < e.dur);
    let si = 0, ri = 0;
    for (const e of R.effects) {
      const p = (t - e.t0) / e.dur;
      if (e.kind === "ring" || e.kind === "heal") {
        const m = rings.current[ri++]; if (!m) continue;
        m.visible = true;
        m.position.set(e.x, heightAt(e.x, e.z) + (e.kind === "heal" ? p * 2 : 0.15), e.z);
        m.scale.setScalar(e.radius * (e.kind === "heal" ? 1 : 0.2 + p));
        const mat = m.material as THREE.MeshBasicMaterial; mat.color.set(e.color); mat.opacity = 1 - p;
      } else {
        const m = spheres.current[si++]; if (!m) continue;
        m.visible = true;
        const mat = m.material as THREE.MeshBasicMaterial; mat.color.set(e.color);
        if (e.kind === "proj") {
          m.position.set(e.x + (e.tx - e.x) * p, heightAt(e.x, e.z) + 1.3 + Math.sin(p * Math.PI) * 0.6, e.z + (e.tz - e.z) * p);
          m.scale.setScalar(e.radius); mat.opacity = 1;
        } else if (e.kind === "slash") {
          m.position.set(e.tx, heightAt(e.tx, e.tz) + 1.1, e.tz); m.scale.setScalar(0.3 + p * 0.9); mat.opacity = 1 - p;
        } else {
          m.position.set(e.x, heightAt(e.x, e.z) + 0.8, e.z); m.scale.setScalar(e.radius * (0.3 + p)); mat.opacity = 1 - p;
        }
      }
    }
    for (; si < POOL; si++) if (spheres.current[si]) spheres.current[si].visible = false;
    for (; ri < POOL; ri++) if (rings.current[ri]) rings.current[ri].visible = false;
  });
  return (
    <>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh key={`s${i}`} ref={(m) => { if (m) spheres.current[i] = m; }} visible={false}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh key={`r${i}`} ref={(m) => { if (m) rings.current[i] = m; }} visible={false} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
}

/** Projects names, health bars and damage numbers into a pooled DOM layer. */
function Labels({ root }: { root: React.RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree();
  const pool = useRef<{ el: HTMLDivElement; name: HTMLDivElement; bar: HTMLDivElement; fill: HTMLDivElement }[]>([]);
  const floats = useRef<HTMLDivElement[]>([]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const host = root.current; if (!host) return;
    for (let i = 0; i < 60; i++) {
      const el = document.createElement("div");
      el.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:none;text-align:center;white-space:nowrap;display:none";
      const name = document.createElement("div"); name.className = "game-text"; name.style.cssText = "font:700 11px var(--font-sans);";
      const bar = document.createElement("div"); bar.style.cssText = "width:44px;height:5px;margin:2px auto 0;background:#000a;border:1px solid #000;border-radius:2px;overflow:hidden";
      const fill = document.createElement("div"); fill.style.cssText = "height:100%;width:100%";
      bar.appendChild(fill); el.appendChild(name); el.appendChild(bar); host.appendChild(el);
      pool.current.push({ el, name, bar, fill });
    }
    for (let i = 0; i < 40; i++) {
      const f = document.createElement("div");
      f.className = "game-text";
      f.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none;font:800 15px var(--font-display);display:none";
      host.appendChild(f); floats.current.push(f);
    }
    return () => { pool.current.forEach((p) => p.el.remove()); floats.current.forEach((f) => f.remove()); pool.current = []; floats.current = []; };
  }, [root]);
  useFrame(() => {
    let i = 0;
    const put = (x: number, y: number, z: number, text: string, color: string, hp: number, barColor: string) => {
      const p = pool.current[i]; if (!p) return;
      v.set(x, y, z).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
      i++;
      p.el.style.display = "block";
      p.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%,-100%)`;
      if (p.name.textContent !== text) p.name.textContent = text;
      p.name.style.color = color;
      p.fill.style.width = `${Math.max(0, Math.min(100, hp))}%`;
      p.fill.style.background = barColor;
    };
    const hpColor = (h: number) => (h > 60 ? "#3fd04a" : h > 30 ? "#e6c229" : "#e0412c");
    for (const m of R.monsters) {
      if (!m.alive || Math.hypot(m.x - R.x, m.z - R.z) > 26) continue;
      const pct = (m.hp / m.def.hp) * 100;
      put(m.x, heightAt(m.x, m.z) + 2.3 * m.def.scale + 0.2, m.z, m.def.name, m.def.boss ? "#ffcf4a" : "#e8e2d0", pct, hpColor(pct));
    }
    for (const r of R.remotes.values()) {
      const skull = r.skull === "red" ? " ☠" : r.skull === "white" ? " ☠︎" : "";
      const color = R.party.has(r.id) ? "#7dd3fc" : r.skull === "red" ? "#ff5a4a" : r.skull === "white" ? "#ffffff" : "#9dff8a";
      put(r.x, heightAt(r.x, r.z) + (r.mount ? 3.2 : 2.4), r.z, `${r.guild ? `[${r.guild}] ` : ""}${r.name}${skull}`, color, r.hp, hpColor(r.hp));
    }
    for (; i < pool.current.length; i++) pool.current[i].el.style.display = "none";

    const t = performance.now() / 1000;
    R.floaters = R.floaters.filter((f) => t - f.t0 < 1.1);
    let fi = 0;
    for (const f of R.floaters) {
      const el = floats.current[fi]; if (!el) break;
      const p = (t - f.t0) / 1.1;
      v.set(f.x, heightAt(f.x, f.z) + 2.4 + p * 1.6, f.z).project(camera);
      if (v.z > 1) continue;
      fi++;
      el.style.display = "block";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%,-50%) scale(${1 + (1 - p) * 0.3})`;
      el.style.opacity = String(1 - p * p);
      el.style.color = f.color;
      if (el.textContent !== f.text) el.textContent = f.text;
    }
    for (; fi < floats.current.length; fi++) floats.current[fi].style.display = "none";
  });
  return null;
}

export function GameScene({ labelRoot, lowGfx }: { labelRoot: React.RefObject<HTMLDivElement | null>; lowGfx: boolean }) {
  return (
    <Canvas shadows dpr={lowGfx ? [1, 1.25] : [1, 1.75]} camera={{ position: [0, 16, 12], fov: 45, near: 0.5, far: 400 }} gl={{ antialias: !lowGfx, powerPreference: "high-performance" }}>
      <color attach="background" args={["#9fc7e0"]} />
      <fog attach="fog" args={["#b9d3e0", 60, 150]} />
      <hemisphereLight args={["#cfe8ff", "#5a4630", 0.55]} />
      <SunFollow />
      <Environment resolution={32} environmentIntensity={0.35}>
        <Lightformer intensity={1} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.6} color="#ffd9a8" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <World />
      <Player />
      <Crowd />
      <TargetMarker />
      <MoveMarker />
      <Effects />
      <NetSync />
      <CameraRig />
      <Labels root={labelRoot} />
      {!lowGfx && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.8} luminanceThreshold={1.05} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.25} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
