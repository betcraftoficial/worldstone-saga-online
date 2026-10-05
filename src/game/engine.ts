// Mutable real-time game state (outside React) + combat rules.
import {
  CITIES, ITEMS, MONSTERS, MONSTER_SPAWNS, MOUNTS, PVP_RULES, VOCATIONS, cityAt, maxHp, maxMana,
  moveSpeed, totalDef, weaponAtk, zoneAt, type MonsterDef, type SpellDef,
} from "./data";
import type { CharRow } from "@/lib/game.server";
import { collide } from "./world";

export type Me = CharRow & { guildTag?: string | null };
export type Remote = {
  id: string; name: string; voc: string; level: number; x: number; z: number; ry: number;
  tx: number; tz: number; tr: number; outfit: string; mount: string | null; hp: number; skull: string;
  guild: string | null; moving: boolean; seen: number;
};
export type MonsterState = {
  idx: number; type: string; def: MonsterDef; region: string;
  x: number; z: number; tx: number; tz: number; ry: number; sx: number; sz: number;
  hp: number; alive: boolean; targetId: string | null; atkCd: number; respawnAt: number;
  attackers: Set<string>; slowUntil: number; dotUntil: number; dotDps: number; dotFrom: string | null;
  wanderAt: number; moving: boolean; hitFlash: number;
};
export type Effect = { kind: "proj" | "ring" | "burst" | "heal" | "slash"; x: number; z: number; tx: number; tz: number; color: string; t0: number; dur: number; radius: number };
export type Floater = { x: number; z: number; text: string; color: string; t0: number };
export type Buff = { stat: "def" | "dmg" | "speed" | "crit" | "absorb"; amount: number; until: number; name: string };
export type Target = { kind: "monster"; idx: number } | { kind: "player"; id: string } | null;

type Sender = (event: string, payload: Record<string, unknown>) => void;

export const R = {
  me: null as Me | null,
  x: 0, z: 0, ry: 0, moving: false,
  moveTarget: null as { x: number; z: number } | null,
  hp: 100, mana: 50,
  buffs: [] as Buff[],
  target: null as Target,
  attackCd: 0,
  cooldowns: {} as Record<string, number>,
  remotes: new Map<string, Remote>(),
  monsters: MONSTER_SPAWNS.map((s): MonsterState => ({
    idx: s.idx, type: s.type, def: MONSTERS[s.type], region: s.region,
    x: s.x, z: s.z, tx: s.x, tz: s.z, ry: 0, sx: s.x, sz: s.z, hp: MONSTERS[s.type].hp, alive: true,
    targetId: null, atkCd: 1, respawnAt: 0, attackers: new Set(), slowUntil: 0, dotUntil: 0, dotDps: 0, dotFrom: null,
    wanderAt: 0, moving: false, hitFlash: 0,
  })),
  region: "aldoria",
  coordinator: false,
  pending: { kills: [] as { type: string; idx: number; share: number }[], hits: 0, manaSpent: 0 },
  effects: [] as Effect[],
  floaters: [] as Floater[],
  keys: new Set<string>(),
  joy: { x: 0, z: 0 },
  lastPvp: null as { id: string; at: number } | null,
  dead: false,
  localSkull: "none",
  localSkullUntil: 0,
  party: new Set<string>(),
  send: (() => {}) as Sender,
  sendGlobal: (() => {}) as Sender,
  log: (_text: string, _color?: string) => {},
  onDeath: () => {},
  camZoom: 1,
};

const now = () => performance.now() / 1000;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function maxHpMe() { return R.me ? maxHp(R.me.vocation, R.me.level) : 100; }
export function maxManaMe() { return R.me ? maxMana(R.me.vocation, R.me.level) : 50; }
export function buff(stat: Buff["stat"]) {
  const t = now();
  R.buffs = R.buffs.filter((b) => b.until > t);
  return R.buffs.filter((b) => b.stat === stat).reduce((a, b) => a + b.amount, 0);
}
export function speedMe() {
  if (!R.me) return 6;
  const m = R.me.mount ? MOUNTS[R.me.mount]?.speed ?? 0 : 0;
  return moveSpeed(R.me.level) * (1 + m + buff("speed"));
}
export function skullMe() {
  if (R.me?.skull && R.me.skull !== "none") return R.me.skull;
  if (R.localSkullUntil > now()) return R.localSkull;
  return "none";
}

export function addEffect(e: Omit<Effect, "t0">, broadcast = false) {
  R.effects.push({ ...e, t0: now() });
  if (R.effects.length > 60) R.effects.shift();
  if (broadcast) R.send("fx", e as unknown as Record<string, unknown>);
}
export function floater(x: number, z: number, text: string, color: string) {
  R.floaters.push({ x, z, text, color, t0: now() });
  if (R.floaters.length > 40) R.floaters.shift();
}

export function inSafe(x: number, z: number) { return !!cityAt(x, z); }

// ---------- damage formulas ----------
function isMage() { return R.me?.vocation === "druid" || R.me?.vocation === "sorcerer"; }
function critRoll() {
  const v = R.me ? VOCATIONS[R.me.vocation] : null;
  return Math.random() < (v?.passive.crit ?? 0) + buff("crit");
}
function dmgMult() {
  const v = R.me ? VOCATIONS[R.me.vocation] : null;
  return 1 + (v?.passive.dmg ?? 0) + buff("dmg");
}
export function autoDamage() {
  const me = R.me!;
  const atk = weaponAtk(me.equipment);
  const sk = isMage() ? me.magic_level + 6 : me.skill_level;
  const max = atk * (sk + 4) * 0.075 + me.level * 0.25;
  let d = rand(max * 0.35, max) * dmgMult();
  const crit = critRoll();
  if (crit) d *= 2;
  return { dmg: Math.max(1, Math.round(d)), crit };
}
export function spellDamage(s: SpellDef) {
  const me = R.me!;
  const v = VOCATIONS[me.vocation];
  const base = me.level * 0.25 + me.magic_level * 3.2 + (isMage() ? 8 : me.skill_level * 1.1 + weaponAtk(me.equipment) * 0.7);
  let d = base * s.power * rand(0.85, 1.15) * (1 + (v.passive.spell ?? 0)) * dmgMult();
  const crit = critRoll();
  if (crit) d *= 2;
  return { dmg: Math.max(1, Math.round(d)), crit };
}
export function healAmount(s: SpellDef) {
  const me = R.me!;
  return Math.round((me.level * 0.3 + me.magic_level * 4 + 20) * s.power * rand(0.9, 1.1));
}

// ---------- targeting helpers ----------
export function targetPos(t: Target): { x: number; z: number } | null {
  if (!t) return null;
  if (t.kind === "monster") { const m = R.monsters[t.idx]; return m?.alive ? m : null; }
  const r = R.remotes.get(t.id);
  return r ?? null;
}
export function canAttackPlayer(r: Remote) {
  if (!R.me) return "Sem personagem";
  if (R.party.has(r.id)) return "Ele é da sua party.";
  if (R.me.level < PVP_RULES.protectionLevel) return `PvP liberado a partir do nível ${PVP_RULES.protectionLevel}.`;
  if (r.level < PVP_RULES.protectionLevel) return "Esse jogador está sob proteção de iniciante.";
  if (inSafe(R.x, R.z) || inSafe(r.x, r.z)) return "Não é permitido atacar em zonas de proteção.";
  return null;
}
export function nearestEnemy(): Target {
  let best: Target = null; let bd = 14;
  for (const m of R.monsters) {
    if (!m.alive || m.region !== R.region) continue;
    const d = Math.hypot(m.x - R.x, m.z - R.z);
    if (d < bd) { bd = d; best = { kind: "monster", idx: m.idx }; }
  }
  return best;
}

// ---------- hitting things ----------
export function hitMonster(idx: number, dmg: number, crit: boolean, color = "#ffffff") {
  const m = R.monsters[idx];
  if (!m?.alive || !R.me) return;
  floater(m.x, m.z, crit ? `${dmg}!` : `${dmg}`, crit ? "#ffd84a" : color);
  m.hitFlash = now();
  if (R.coordinator) applyMonsterHit(idx, dmg, R.me.id);
  else { R.send("mhit", { m: idx, d: dmg, f: R.me.id }); m.attackers.add(R.me.id); }
}

export function applyMonsterHit(idx: number, dmg: number, from: string) {
  const m = R.monsters[idx];
  if (!m?.alive) return;
  m.hp -= Math.min(dmg, 5000);
  m.attackers.add(from);
  if (!m.targetId) m.targetId = from;
  if (m.hp <= 0) killMonster(m);
}

function killMonster(m: MonsterState) {
  m.alive = false;
  m.hp = 0;
  m.respawnAt = now() + m.def.respawn;
  const a = [...m.attackers];
  R.send("mdie", { m: m.idx, a });
  onMonsterDied(m.idx, a);
}

export function onMonsterDied(idx: number, attackers: string[]) {
  const m = R.monsters[idx];
  m.alive = false; m.hp = 0; m.targetId = null;
  m.attackers.clear();
  addEffect({ kind: "burst", x: m.x, z: m.z, tx: m.x, tz: m.z, color: m.def.color2, dur: 0.8, radius: 2 * m.def.scale });
  if (R.target?.kind === "monster" && R.target.idx === idx) R.target = null;
  if (R.me && attackers.includes(R.me.id)) {
    R.pending.kills.push({ type: m.type, idx, share: Math.min(8, attackers.length) });
    R.log(`Você derrotou ${m.def.name}.`, "#ffd84a");
  }
}

export function hitPlayer(r: Remote, dmg: number, crit: boolean) {
  if (!R.me) return;
  const why = canAttackPlayer(r);
  if (why) { R.log(why, "#ff8a7a"); R.target = null; return; }
  if (r.skull === "none" && zoneAt(R.x, R.z)?.kind !== "pvp" && skullMe() === "none") {
    R.localSkull = "white"; R.localSkullUntil = now() + PVP_RULES.whiteSkullMinutes * 60;
    R.log("Você atacou um jogador inocente e recebeu uma skull branca.", "#ffffff");
  }
  floater(r.x, r.z, crit ? `${dmg}!` : `${dmg}`, crit ? "#ffd84a" : "#ff9b9b");
  R.send("phit", { t: r.id, d: dmg, f: R.me.id });
}

/** Damage arriving at the local player (from monsters or players). */
export function receiveDamage(raw: number, fromPlayer?: string) {
  if (!R.me || R.dead) return;
  if (fromPlayer) {
    const atk = R.remotes.get(fromPlayer);
    if (!atk || inSafe(R.x, R.z) || R.me.level < PVP_RULES.protectionLevel || R.party.has(fromPlayer)) return;
    R.lastPvp = { id: fromPlayer, at: now() };
  }
  const v = VOCATIONS[R.me.vocation];
  const def = Math.min(0.7, totalDef(R.me.equipment) * 0.012 + (v.passive.def ?? 0) + buff("def"));
  let d = Math.round(raw * (1 - def));
  const absorb = buff("absorb");
  if (absorb > 0 && R.mana > 0) {
    const m = Math.min(R.mana, Math.round(d * absorb));
    R.mana -= m; d -= m;
    floater(R.x, R.z, `${m}`, "#5fb6ff");
  }
  if (d <= 0) return;
  R.hp -= d;
  floater(R.x, R.z, `-${d}`, "#ff4d4d");
  if (R.hp <= 0) { R.hp = 0; R.dead = true; R.onDeath(); }
}

// ---------- local player actions ----------
export function useSpell(s: SpellDef): string | null {
  const me = R.me;
  if (!me || R.dead) return "";
  const t = now();
  if (me.level < s.minLevel) return `Requer nível ${s.minLevel}.`;
  if ((R.cooldowns[s.id] ?? 0) > t) return "Em recarga.";
  if (R.mana < s.mana) return "Mana insuficiente.";
  const voc = VOCATIONS[me.vocation];

  if (s.kind === "self") {
    if (s.buff) R.buffs.push({ stat: s.buff.stat, amount: s.buff.amount, until: t + s.buff.duration, name: s.name });
    addEffect({ kind: "ring", x: R.x, z: R.z, tx: R.x, tz: R.z, color: s.color, dur: 0.9, radius: 2.5 }, true);
  } else if (s.kind === "heal") {
    const h = healAmount(s);
    R.hp = Math.min(maxHpMe(), R.hp + h);
    floater(R.x, R.z, `+${h}`, "#7dff8a");
    addEffect({ kind: "heal", x: R.x, z: R.z, tx: R.x, tz: R.z, color: s.color, dur: 1.1, radius: 1.6 }, true);
  } else {
    const tp = targetPos(R.target);
    const center = s.range === 0 ? { x: R.x, z: R.z } : tp;
    if (!center) return "Selecione um alvo.";
    if (s.range > 0 && Math.hypot(center.x - R.x, center.z - R.z) > s.range + 0.5) return "Alvo fora de alcance.";
    if (s.kind === "target") {
      const { dmg, crit } = spellDamage(s);
      addEffect({ kind: s.range > 3 ? "proj" : "slash", x: R.x, z: R.z, tx: center.x, tz: center.z, color: s.color, dur: s.range > 3 ? 0.35 : 0.3, radius: 0.5 }, true);
      if (R.target?.kind === "monster") {
        const m = R.monsters[R.target.idx];
        if (s.dot) { m.dotUntil = t + s.dot.duration; m.dotDps = Math.max(1, Math.round(dmg * s.dot.dps)); m.dotFrom = me.id; if (!R.coordinator) R.send("mdot", { m: m.idx, u: s.dot.duration, d: m.dotDps, f: me.id }); }
        if (s.slow) { m.slowUntil = t + 4; if (!R.coordinator) R.send("mslow", { m: m.idx }); }
        hitMonster(R.target.idx, dmg, crit, s.color);
      } else if (R.target?.kind === "player") {
        const r = R.remotes.get(R.target.id);
        if (r) hitPlayer(r, dmg, crit);
      }
    } else {
      addEffect({ kind: "ring", x: center.x, z: center.z, tx: center.x, tz: center.z, color: s.color, dur: 0.7, radius: s.radius ?? 4 }, true);
      for (const m of R.monsters) {
        if (!m.alive || m.region !== R.region) continue;
        if (Math.hypot(m.x - center.x, m.z - center.z) <= (s.radius ?? 4)) {
          const { dmg, crit } = spellDamage(s);
          if (s.slow) { m.slowUntil = t + 4; if (!R.coordinator) R.send("mslow", { m: m.idx }); }
          hitMonster(m.idx, dmg, crit, s.color);
        }
      }
      if (zoneAt(R.x, R.z)?.kind === "pvp" || (R.target?.kind === "player")) {
        for (const r of R.remotes.values()) {
          if (Math.hypot(r.x - center.x, r.z - center.z) <= (s.radius ?? 4) && !canAttackPlayer(r)) {
            const { dmg, crit } = spellDamage(s);
            hitPlayer(r, dmg, crit);
          }
        }
      }
    }
  }
  R.mana -= s.mana;
  R.pending.manaSpent += s.mana;
  R.cooldowns[s.id] = t + s.cooldown;
  void voc;
  return null;
}

export function tickPlayer(dt: number) {
  const me = R.me;
  if (!me || R.dead) return;
  const t = now();
  const v = VOCATIONS[me.vocation];
  // regen
  const safe = inSafe(R.x, R.z) ? 3 : 1;
  R.hp = Math.min(maxHpMe(), R.hp + (maxHpMe() / 140) * dt * safe);
  R.mana = Math.min(maxManaMe(), R.mana + (maxManaMe() / 70) * dt * safe * (1 + (v.passive.manaRegen ?? 0)));

  // movement input
  let mx = 0, mz = 0;
  const k = R.keys;
  if (k.has("w") || k.has("arrowup")) mz -= 1;
  if (k.has("s") || k.has("arrowdown")) mz += 1;
  if (k.has("a") || k.has("arrowleft")) mx -= 1;
  if (k.has("d") || k.has("arrowright")) mx += 1;
  mx += R.joy.x; mz += R.joy.z;
  if (mx || mz) R.moveTarget = null;

  const tp = targetPos(R.target);
  if (!mx && !mz && R.moveTarget) {
    const dx = R.moveTarget.x - R.x, dz = R.moveTarget.z - R.z;
    if (Math.hypot(dx, dz) < 0.3) R.moveTarget = null; else { mx = dx; mz = dz; }
  } else if (!mx && !mz && tp && v.attackRange < 3) {
    // melee chase
    const dx = tp.x - R.x, dz = tp.z - R.z;
    if (Math.hypot(dx, dz) > v.attackRange * 0.85) { mx = dx; mz = dz; }
  }
  const len = Math.hypot(mx, mz);
  R.moving = len > 0.01;
  if (R.moving) {
    const sp = speedMe() * Math.min(1, len);
    const nx = R.x + (mx / len) * sp * dt;
    const nz = R.z + (mz / len) * sp * dt;
    [R.x, R.z] = collide(nx, nz);
    R.ry = Math.atan2(mx, mz);
  } else if (tp) {
    R.ry = Math.atan2(tp.x - R.x, tp.z - R.z);
  }

  // auto attack
  R.attackCd -= dt;
  if (tp && R.attackCd <= 0) {
    const dist = Math.hypot(tp.x - R.x, tp.z - R.z);
    if (dist <= v.attackRange + 0.3) {
      R.attackCd = v.attackSpeed;
      const { dmg, crit } = autoDamage();
      const ranged = v.attackRange > 3;
      const col = me.vocation === "druid" ? "#9be8ff" : me.vocation === "sorcerer" ? "#ff8a3d" : me.vocation === "paladin" ? "#f3e2a0" : "#ffffff";
      addEffect({ kind: ranged ? "proj" : "slash", x: R.x, z: R.z, tx: tp.x, tz: tp.z, color: col, dur: ranged ? 0.3 : 0.22, radius: 0.35 }, true);
      if (R.target?.kind === "monster") { hitMonster(R.target.idx, dmg, crit); R.pending.hits++; if (isMage()) R.pending.manaSpent += 1; }
      else if (R.target?.kind === "player") { const r = R.remotes.get(R.target.id); if (r) hitPlayer(r, dmg, crit); }
    }
  }
}

// ---------- monster AI (runs only on the region coordinator) ----------
export function simulateMonsters(dt: number, onSnapshot: (rows: number[][]) => void, full: boolean) {
  const t = now();
  const rows: number[][] = [];
  const players: { id: string; x: number; z: number }[] = [];
  if (R.me && !R.dead) players.push({ id: R.me.id, x: R.x, z: R.z });
  for (const r of R.remotes.values()) if (r.hp > 0) players.push(r);

  for (const m of R.monsters) {
    if (m.region !== R.region) continue;
    const before = `${m.x.toFixed(1)}${m.z.toFixed(1)}${m.hp}${m.alive}${m.targetId}`;
    if (!m.alive) {
      if (t > m.respawnAt && m.respawnAt > 0) {
        m.alive = true; m.hp = m.def.hp; m.x = m.sx; m.z = m.sz; m.tx = m.sx; m.tz = m.sz; m.attackers.clear(); m.targetId = null;
      }
    } else {
      if (m.dotUntil > t && m.dotFrom) {
        m.hp -= m.dotDps * dt;
        m.attackers.add(m.dotFrom);
        if (m.hp <= 0) { killMonster(m); continue; }
      }
      let target = m.targetId ? players.find((p) => p.id === m.targetId) : undefined;
      if (target && (inSafe(target.x, target.z) || Math.hypot(target.x - m.sx, target.z - m.sz) > 32)) target = undefined;
      if (!target) {
        m.targetId = null;
        const aggro = m.def.boss ? 12 : 8;
        let bd = aggro;
        for (const p of players) {
          const d = Math.hypot(p.x - m.x, p.z - m.z);
          if (d < bd && !inSafe(p.x, p.z)) { bd = d; target = p; }
        }
        if (target) m.targetId = target.id;
      }
      let gx = m.x, gz = m.z;
      if (target) {
        const d = Math.hypot(target.x - m.x, target.z - m.z);
        if (d > m.def.range * 0.85) { gx = target.x; gz = target.z; }
        m.atkCd -= dt;
        if (d <= m.def.range + 0.6 && m.atkCd <= 0) {
          m.atkCd = m.def.boss ? 1.3 : 1.7;
          const dmg = Math.round(rand(m.def.dmg[0], m.def.dmg[1]));
          if (m.def.range > 3) addEffect({ kind: "proj", x: m.x, z: m.z, tx: target.x, tz: target.z, color: m.def.color2, dur: 0.4, radius: 0.5 }, true);
          if (target.id === R.me?.id) receiveDamage(dmg);
          else R.send("matk", { m: m.idx, t: target.id, d: dmg });
        }
      } else {
        // leash home & wander
        const home = Math.hypot(m.sx - m.x, m.sz - m.z);
        if (home > 2.5 && m.hp < m.def.hp) m.hp = Math.min(m.def.hp, m.hp + m.def.hp * 0.2 * dt);
        if (t > m.wanderAt) { m.wanderAt = t + 3 + Math.random() * 5; m.tx = m.sx + rand(-5, 5); m.tz = m.sz + rand(-5, 5); }
        gx = m.tx; gz = m.tz;
        if (home > 18) { gx = m.sx; gz = m.sz; }
      }
      const dx = gx - m.x, dz = gz - m.z;
      const dl = Math.hypot(dx, dz);
      m.moving = dl > 0.2;
      if (m.moving) {
        const sp = m.def.speed * (m.slowUntil > t ? 0.45 : 1) * (target ? 1 : 0.4);
        let nx = m.x + (dx / dl) * Math.min(dl, sp * dt);
        let nz = m.z + (dz / dl) * Math.min(dl, sp * dt);
        if (inSafe(nx, nz)) { nx = m.x; nz = m.z; }
        [nx, nz] = collide(nx, nz, 0.4 * m.def.scale);
        m.ry = Math.atan2(dx, dz);
        m.x = nx; m.z = nz;
      }
      if (!target) { m.tx = m.tx ?? m.x; }
    }
    const after = `${m.x.toFixed(1)}${m.z.toFixed(1)}${m.hp}${m.alive}${m.targetId}`;
    if (full || before !== after) {
      rows.push([m.idx, Math.round(m.x * 10) / 10, Math.round(m.z * 10) / 10, Math.max(0, Math.round(m.hp)), m.alive ? 1 : 0]);
    }
  }
  if (rows.length) onSnapshot(rows);
}

/** non-coordinators smooth monsters toward the last snapshot */
export function interpolateMonsters(dt: number) {
  const k = 1 - Math.exp(-10 * dt);
  for (const m of R.monsters) {
    if (m.region !== R.region) continue;
    const dx = m.tx - m.x, dz = m.tz - m.z;
    const d = Math.hypot(dx, dz);
    m.moving = d > 0.05;
    if (d > 8) { m.x = m.tx; m.z = m.tz; }
    else if (m.moving) { m.x += dx * k; m.z += dz * k; m.ry = Math.atan2(dx, dz); }
  }
}

export function applySnapshot(rows: number[][]) {
  for (const [idx, x, z, hp, alive] of rows) {
    const m = R.monsters[idx];
    if (!m) continue;
    if (!m.alive && alive) { m.x = x; m.z = z; }
    m.tx = x; m.tz = z; m.hp = hp; m.alive = !!alive;
  }
}

export function homeTemple() {
  const c = CITIES.find((c) => c.id === R.me?.home_city) ?? CITIES[0];
  return { x: c.x, z: c.z + 4 };
}

export { ITEMS };
