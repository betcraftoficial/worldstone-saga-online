// Realtime networking: one channel per world region (shard) + one global channel.
// Regions keep N² broadcast cost bounded; monsters are simulated by the region
// coordinator (lowest character id present) and snapshotted to everyone else.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { R, maxHpMe, addEffect, applyMonsterHit, applySnapshot, onMonsterDied, receiveDamage, skullMe, type Effect } from "./engine";
import { useUI } from "./store";

let region: RealtimeChannel | null = null;
let global: RealtimeChannel | null = null;
let regionId = "";

const clean = (s: unknown, n = 200) => String(s ?? "").slice(0, n);

export function myState() {
  const me = R.me!;
  return {
    id: me.id, n: me.name, v: me.vocation, l: me.level,
    x: Math.round(R.x * 100) / 100, z: Math.round(R.z * 100) / 100, r: Math.round(R.ry * 100) / 100,
    o: me.outfit, m: me.mount, h: Math.round((R.hp / Math.max(1, maxHpMe())) * 100), s: skullMe(),
    g: me.guildTag ?? null, mv: R.moving ? 1 : 0,
  };
}
export function joinRegion(id: string) {
  if (!R.me || id === regionId) return;
  if (region) supabase.removeChannel(region);
  regionId = id;
  R.region = id;
  R.remotes.clear();
  R.coordinator = false;
  const me = R.me;
  const ch = supabase.channel(`storm:region:${id}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
  ch.on("broadcast", { event: "st" }, ({ payload: p }) => {
    if (!p?.id || p.id === me.id) return;
    const ex = R.remotes.get(p.id);
    const base = {
      id: p.id, name: clean(p.n, 18), voc: p.v, level: p.l | 0, tx: +p.x, tz: +p.z, tr: +p.r,
      outfit: p.o, mount: p.m ?? null, hp: p.h, skull: p.s ?? "none", guild: p.g ?? null, moving: !!p.mv, seen: Date.now(),
    };
    if (ex) Object.assign(ex, base);
    else R.remotes.set(p.id, { ...base, x: base.tx, z: base.tz, ry: base.tr });
  })
    .on("broadcast", { event: "mon" }, ({ payload }) => { if (!R.coordinator) applySnapshot(payload.s ?? []); })
    .on("broadcast", { event: "mhit" }, ({ payload: p }) => { if (R.coordinator) applyMonsterHit(p.m | 0, Math.max(0, +p.d || 0), String(p.f)); })
    .on("broadcast", { event: "mdot" }, ({ payload: p }) => {
      if (!R.coordinator) return;
      const m = R.monsters[p.m | 0]; if (!m) return;
      m.dotUntil = performance.now() / 1000 + Math.min(10, +p.u || 0); m.dotDps = Math.min(2000, +p.d || 0); m.dotFrom = String(p.f);
    })
    .on("broadcast", { event: "mslow" }, ({ payload: p }) => { const m = R.monsters[p.m | 0]; if (m) m.slowUntil = performance.now() / 1000 + 4; })
    .on("broadcast", { event: "mdie" }, ({ payload: p }) => onMonsterDied(p.m | 0, (p.a ?? []).map(String)))
    .on("broadcast", { event: "matk" }, ({ payload: p }) => { if (p.t === me.id) receiveDamage(Math.max(0, +p.d || 0)); })
    .on("broadcast", { event: "phit" }, ({ payload: p }) => { if (p.t === me.id) receiveDamage(Math.max(0, Math.min(3000, +p.d || 0)), String(p.f)); })
    .on("broadcast", { event: "fx" }, ({ payload: p }) => addEffect(p as Omit<Effect, "t0">))
    .on("broadcast", { event: "chat" }, ({ payload: p }) => useUI.getState().push({ ch: "local", from: clean(p.n, 18), text: clean(p.t) }))
    .on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ name: string }>();
      const ids = Object.keys(st).sort();
      R.coordinator = ids[0] === me.id;
      for (const rid of [...R.remotes.keys()]) if (!st[rid]) R.remotes.delete(rid);
      useUI.getState().setRoster(ids.map((i) => ({ id: i, name: st[i]?.[0]?.name ?? "?" })));
    })
    .subscribe((status) => {
      console.log("[net] region", id, status);
      if (status === "SUBSCRIBED") {
        ch.track({ name: me.name });
        ch.send({ type: "broadcast", event: "st", payload: myState() });
      }
    });
  region = ch;
  R.send = (event, payload) => { if (region && !document.hidden) region.send({ type: "broadcast", event, payload }); };
}

export function joinGlobal() {
  if (global || !R.me) return;
  const me = R.me;
  const ch = supabase.channel("storm:global", { config: { broadcast: { self: false }, presence: { key: me.id } } });
  ch.on("broadcast", { event: "chat" }, ({ payload: p }) => useUI.getState().push({ ch: "global", from: clean(p.n, 18), text: clean(p.t) }))
    .on("broadcast", { event: "pinv" }, ({ payload: p }) => { if (p.to === me.id) useUI.getState().setPartyInvite({ from: String(p.f), name: clean(p.n, 18) }); })
    .on("broadcast", { event: "pacc" }, ({ payload: p }) => {
      if (p.to !== me.id) return;
      R.party.add(String(p.f));
      useUI.getState().push({ ch: "party", text: `${clean(p.n, 18)} entrou na party.` });
      R.sendGlobal("pset", { members: [me.id, ...R.party] });
      useUI.getState().bumpParty();
    })
    .on("broadcast", { event: "pset" }, ({ payload: p }) => {
      const members: string[] = (p.members ?? []).map(String);
      if (!members.includes(me.id)) return;
      R.party = new Set(members.filter((m) => m !== me.id));
      useUI.getState().bumpParty();
    })
    .on("broadcast", { event: "pleave" }, ({ payload: p }) => { if (R.party.delete(String(p.f))) useUI.getState().bumpParty(); })
    .on("broadcast", { event: "pchat" }, ({ payload: p }) => {
      if ((p.members ?? []).includes(me.id)) useUI.getState().push({ ch: "party", from: clean(p.n, 18), text: clean(p.t) });
    })
    .on("presence", { event: "sync" }, () => useUI.getState().setOnline(Object.keys(ch.presenceState()).length))
    .subscribe((s) => { if (s === "SUBSCRIBED") ch.track({ name: me.name }); });
  global = ch;
  R.sendGlobal = (event, payload) => global?.send({ type: "broadcast", event, payload });
}

export function leaveAll() {
  if (region) supabase.removeChannel(region);
  if (global) supabase.removeChannel(global);
  region = null; global = null; regionId = "";
  R.send = () => {}; R.sendGlobal = () => {};
}
