import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { loadCharacter, reportDeath, syncProgress, useItem } from "@/lib/game.functions";
import { ITEMS, VOCATIONS, regionOf } from "@/game/data";
import { R, maxHpMe, maxManaMe, nearestEnemy, useSpell } from "@/game/engine";
import { joinGlobal, joinRegion, leaveAll } from "@/game/net";
import { useUI } from "@/game/store";
import { commit } from "@/game/ui/commit";
import { GameScene } from "@/game/three/Scene";
import { Chat, Hotbar, Joystick, MenuBar, Minimap, MobileActions, StatusFrame, TargetFrame } from "@/game/ui/Hud";
import { Panels } from "@/game/ui/Panels";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/play")({
  ssr: false,
  validateSearch: z.object({ c: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Jogando — Eldrath Online" },
      { name: "description", content: "Explore o mundo de Eldrath ao vivo com outros jogadores." },
      { property: "og:title", content: "Jogando — Eldrath Online" },
      { property: "og:description", content: "Explore o mundo de Eldrath ao vivo com outros jogadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Play,
});

const PANEL_KEYS: Record<string, Parameters<ReturnType<typeof useUI.getState>["setPanel"]>[0]> = {
  i: "inventory", c: "character", k: "skills", q: "quests", o: "look", p: "party", g: "guild", t: "trade", l: "store",
};

function Play() {
  const { c } = Route.useSearch();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const me = useUI((s) => s.me);
  const dead = useUI((s) => s.dead);
  const invite = useUI((s) => s.partyInvite);
  const [bigMap, setBigMap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelRoot = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile();
  const syncing = useRef(false);

  const load = useCallback(async () => {
    if (!c) return;
    const r = await loadCharacter({ data: { id: c } });
    const first = !R.me;
    const m = commit(r.character, r.guild?.tag ?? null);
    if (first) {
      R.x = m.pos_x; R.z = m.pos_z; R.hp = m.hp; R.mana = m.mana;
    }
    return m;
  }, [c]);

  // boot
  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/" }); return; }
    if (!c) { nav({ to: "/characters" }); return; }
    let alive = true;
    (window as unknown as { __R: typeof R }).__R = R;
    R.log = (text, color) => useUI.getState().push({ ch: "system", text, color });
    load().then((m) => {
      if (!alive || !m) return;
      joinGlobal();
      joinRegion(regionOf(R.x, R.z));
      R.log(`Bem-vindo a Eldrath, ${m.name}! WASD/toque no chão para andar, clique em monstros para atacar.`, "#ffd84a");
    }).catch((e) => setError((e as Error).message));
    const onReload = () => load();
    window.addEventListener("eldrath:reload", onReload);
    return () => { alive = false; window.removeEventListener("eldrath:reload", onReload); leaveAll(); R.me = null; useUI.getState().setMe(null); };
  }, [user, loading, c, nav, load]);

  // authoritative progress sync every 4s
  const flush = useCallback(async () => {
    if (!R.me || syncing.current || R.dead) return;
    syncing.current = true;
    const pending = R.pending;
    R.pending = { kills: [], hits: 0, manaSpent: 0 };
    try {
      const prevLevel = R.me.level;
      const r = await syncProgress({ data: { id: R.me.id, x: R.x, z: R.z, hp: R.hp, mana: R.mana, kills: pending.kills.slice(0, 30), hits: pending.hits, manaSpent: Math.round(pending.manaSpent) } });
      const m = commit(r.character);
      if (Math.hypot(m.pos_x - R.x, m.pos_z - R.z) > 30) { R.x = m.pos_x; R.z = m.pos_z; }
      if (m.level > prevLevel) { R.hp = maxHpMe(); R.mana = maxManaMe(); toast.success(`Nível ${m.level}!`); }
      for (const e of r.events) R.log(e.text, e.type === "level" ? "#ffd84a" : e.type === "skill" ? "#7dd3fc" : e.type === "warn" ? "#ff8a7a" : "#c9e8a0");
    } catch (e) {
      R.pending.kills.push(...pending.kills); R.pending.hits += pending.hits; R.pending.manaSpent += pending.manaSpent;
      console.warn("sync failed", e);
    } finally { syncing.current = false; }
  }, []);
  useEffect(() => {
    const t = setInterval(flush, 4000);
    const unload = () => { flush(); };
    window.addEventListener("pagehide", unload);
    return () => { clearInterval(t); window.removeEventListener("pagehide", unload); };
  }, [flush]);

  // death
  useEffect(() => {
    R.onDeath = () => { useUI.getState().setDead(true); R.target = null; R.moveTarget = null; };
  }, []);
  const respawn = async () => {
    if (!R.me) return;
    await flush();
    const killer = R.lastPvp && performance.now() / 1000 - R.lastPvp.at < 30 ? R.lastPvp.id : null;
    try {
      const r = await reportDeath({ data: { id: R.me.id, killerId: killer } });
      const m = commit(r.character);
      R.x = m.pos_x; R.z = m.pos_z; R.hp = maxHpMe(); R.mana = maxManaMe(); R.dead = false; R.lastPvp = null; R.buffs = [];
      r.events.forEach((t) => R.log(t, "#ff8a7a"));
      useUI.getState().setDead(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { R.keys.add(k); e.preventDefault(); return; }
      if (!R.me) return;
      if (k >= "1" && k <= "4") { const s = VOCATIONS[R.me.vocation].spells[+k - 1]; const err = s && useSpell(s); if (err) R.log(err, "#ff8a7a"); return; }
      if (k === "5" || k === "6") { quickPotion(k === "5" ? "pocao_vida" : "pocao_mana"); return; }
      if (k === "tab" || k === " ") { e.preventDefault(); R.target = nearestEnemy(); return; }
      if (k === "escape") { useUI.setState({ panel: null }); R.target = null; setBigMap(false); return; }
      if (k === "m") { setBigMap((b) => !b); return; }
      if (PANEL_KEYS[k]) useUI.getState().setPanel(PANEL_KEYS[k]);
    };
    const up = (e: KeyboardEvent) => R.keys.delete(e.key.toLowerCase());
    const blur = () => R.keys.clear();
    const wheel = (e: WheelEvent) => { if ((e.target as HTMLElement)?.tagName === "CANVAS") R.camZoom = Math.max(0.55, Math.min(1.7, R.camZoom + e.deltaY * 0.001)); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); window.addEventListener("wheel", wheel, { passive: true });
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); window.removeEventListener("wheel", wheel); };
  }, []);

  if (error) return (
    <div className="flex min-h-screen items-center justify-center p-4"><div className="panel max-w-sm p-6 text-center"><p className="mb-4">{error}</p><Link to="/characters" className="btn-gold px-4 py-2">Voltar</Link></div></div>
  );
  if (!me) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3"><div className="panel-title text-3xl">ELDRATH</div><div className="text-muted-foreground animate-pulse">Entrando no mundo…</div></div>
  );

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background">
      <GameScene labelRoot={labelRoot} lowGfx={mobile} />
      <div ref={labelRoot} className="pointer-events-none absolute inset-0 overflow-hidden" />

      <div className="pointer-events-none absolute inset-0 p-2 md:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-2"><StatusFrame /></div>
          <div className="hidden md:block"><TargetFrame /></div>
          <div className="flex flex-col items-end gap-2">
            <Minimap big={false} onToggle={() => setBigMap(true)} />
            <MenuBar />
            <Link to="/characters" className="panel pointer-events-auto px-2 py-1 text-[11px]">Trocar personagem</Link>
          </div>
        </div>
        <div className="mt-2 flex justify-center md:hidden"><TargetFrame /></div>

        {mobile ? (
          <>
            <div className="absolute bottom-[170px] left-2"><Chat compact /></div>
            <div className="absolute bottom-3 left-3"><Joystick /></div>
            <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
              <MobileActions />
              <div className="origin-bottom-right scale-[0.9]"><Hotbar characterId={me.id} /></div>
            </div>
          </>
        ) : (
          <>
            <div className="absolute bottom-3 left-3"><Chat compact={false} /></div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2"><Hotbar characterId={me.id} /></div>
          </>
        )}
      </div>

      {bigMap && <><div className="fixed inset-0 z-30 bg-background/60" onClick={() => setBigMap(false)} /><Minimap big onToggle={() => setBigMap(false)} /></>}
      <Panels />

      {invite && (
        <div className="panel fixed left-1/2 top-24 z-40 -translate-x-1/2 p-4 text-center">
          <p className="mb-3"><b className="text-primary">{invite.name}</b> convidou você para uma party.</p>
          <div className="flex justify-center gap-2">
            <button className="btn-gold px-3 py-1" onClick={() => { R.party.add(invite.from); R.sendGlobal("pacc", { to: invite.from, f: me.id, n: me.name }); useUI.getState().setPartyInvite(null); useUI.getState().bumpParty(); }}>Aceitar</button>
            <button className="btn-wood px-3 py-1" onClick={() => useUI.getState().setPartyInvite(null)}>Recusar</button>
          </div>
        </div>
      )}

      {dead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="panel p-8 text-center">
            <h2 className="panel-title mb-2 text-4xl text-hp">Você morreu</h2>
            <p className="mb-6 text-muted-foreground">Você renascerá no templo da sua cidade.</p>
            <button className="btn-gold px-6 py-2 text-lg" onClick={respawn}>Renascer</button>
          </div>
        </div>
      )}
    </div>
  );
}

let potionLock = 0;
async function quickPotion(id: string) {
  if (!R.me || potionLock > performance.now()) return;
  potionLock = performance.now() + 1000;
  if (!R.me.inventory.some((s) => s.id === id)) { R.log(`Você não tem ${ITEMS[id].name}.`, "#ff8a7a"); return; }
  try {
    const r = await useItem({ data: { id: R.me.id, item: id } });
    if (r.use.hp) R.hp = Math.min(maxHpMe(), R.hp + r.use.hp);
    if (r.use.mana) R.mana = Math.min(maxManaMe(), R.mana + r.use.mana);
    commit({ ...R.me, inventory: r.inventory });
  } catch (e) { toast.error((e as Error).message); }
}
