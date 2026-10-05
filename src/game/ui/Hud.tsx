import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CITIES, ITEMS, VOCATIONS, ZONES, WORLD_SIZE, cityAt, expForLevel, zoneAt } from "../data";
import { R, maxHpMe, maxManaMe, nearestEnemy, skullMe, targetPos, useSpell } from "../engine";
import { useUI, type ChatMsg, type Panel } from "../store";
import { groundColor } from "../world";
import { useItem } from "@/lib/game.functions";

export function useTick(ms = 120) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-sm border border-border bg-background/80">
      <div className={`h-full ${color} transition-[width] duration-150`} style={{ width: `${pct}%` }} />
      <span className="game-text absolute inset-0 flex items-center justify-center text-[10px] font-bold text-parchment">{label ?? `${Math.round(value)} / ${Math.round(max)}`}</span>
    </div>
  );
}

export function StatusFrame() {
  useTick(100);
  const me = useUI((s) => s.me);
  if (!me) return null;
  const v = VOCATIONS[me.vocation];
  const cur = expForLevel(me.level), next = expForLevel(me.level + 1);
  const xpPct = ((me.exp - cur) / Math.max(1, next - cur)) * 100;
  const t = performance.now() / 1000;
  const boost = me.xp_boost_until && new Date(me.xp_boost_until).getTime() > Date.now();
  const sk = skullMe();
  return (
    <div className="panel pointer-events-auto w-[210px] p-2 md:w-[260px]">
      <div className="mb-1 flex items-center justify-between">
        <div className="min-w-0">
          <div className="truncate font-display text-sm text-parchment">{me.guildTag ? `[${me.guildTag}] ` : ""}{me.name}{sk !== "none" && <span className={sk === "red" ? "text-hp" : "text-parchment"}> ☠</span>}</div>
          <div className="text-[11px] text-muted-foreground">{v.name} · Nível {me.level}</div>
        </div>
        <span className="h-3 w-3 rounded-full" style={{ background: v.color }} />
      </div>
      <div className="space-y-1">
        <Bar value={R.hp} max={maxHpMe()} color="bg-hp" />
        <Bar value={R.mana} max={maxManaMe()} color="bg-mana" />
        <Bar value={xpPct} max={100} color="bg-xp" label={`XP ${xpPct.toFixed(1)}%${boost ? " · +50%" : ""}`} />
      </div>
      {R.buffs.filter((b) => b.until > t).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {R.buffs.filter((b) => b.until > t).map((b, i) => (
            <span key={i} className="slot px-1 text-[10px] text-primary">{b.name} {Math.ceil(b.until - t)}s</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TargetFrame() {
  useTick(150);
  const t = R.target;
  const p = targetPos(t);
  if (!t || !p) return null;
  let name = "", pct = 0, sub = "";
  if (t.kind === "monster") { const m = R.monsters[t.idx]; name = m.def.name; pct = (m.hp / m.def.hp) * 100; sub = m.def.boss ? "CHEFE" : `${m.def.exp} exp`; }
  else { const r = R.remotes.get(t.id)!; name = r.name; pct = r.hp; sub = `Jogador · Nível ${r.level}`; }
  return (
    <div className="panel pointer-events-auto w-[200px] p-2 text-center md:w-[240px]">
      <div className="flex items-center justify-between">
        <span className="truncate font-display text-sm text-parchment">{name}</span>
        <button className="text-xs text-muted-foreground" onClick={() => (R.target = null)}>✕</button>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-primary">{sub}</div>
      <Bar value={pct} max={100} color="bg-hp" label={`${Math.round(pct)}%`} />
    </div>
  );
}

let minimapBg: HTMLCanvasElement | null = null;
function getMinimapBg() {
  if (minimapBg) return minimapBg;
  const N = 280;
  const c = document.createElement("canvas"); c.width = N; c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const wx = (x / N) * WORLD_SIZE * 2 - WORLD_SIZE, wz = (y / N) * WORLD_SIZE * 2 - WORLD_SIZE;
    const [r, g, b] = groundColor(wx, wz);
    const i = (y * N + x) * 4;
    img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  minimapBg = c;
  return c;
}

export function Minimap({ big, onToggle }: { big: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0; let last = 0;
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      if (ts - last < 150) return; last = ts;
      const c = ref.current; if (!c) return;
      const ctx = c.getContext("2d")!;
      const S = c.width;
      const bg = getMinimapBg();
      const view = big ? WORLD_SIZE * 2 : 110;
      const cx = big ? 0 : R.x, cz = big ? 0 : R.z;
      const w2p = (x: number, z: number) => [((x - cx) / view + 0.5) * S, ((z - cz) / view + 0.5) * S];
      const bgScale = bg.width / (WORLD_SIZE * 2);
      ctx.fillStyle = "#2c7aa8"; ctx.fillRect(0, 0, S, S);
      ctx.drawImage(bg, (cx - view / 2 + WORLD_SIZE) * bgScale, (cz - view / 2 + WORLD_SIZE) * bgScale, view * bgScale, view * bgScale, 0, 0, S, S);
      ctx.font = `bold ${big ? 12 : 10}px Cinzel, serif`; ctx.textAlign = "center";
      for (const city of CITIES) { const [x, y] = w2p(city.x, city.z); ctx.fillStyle = "#ffe6a0"; ctx.fillText(city.name, x, y - 4); ctx.fillRect(x - 2, y - 2, 4, 4); }
      if (big) for (const z of ZONES) { const [x, y] = w2p(z.x, z.z); ctx.fillStyle = z.kind === "pvp" ? "#ff6b5a" : "#ffb38a"; ctx.fillText(z.name, x, y); }
      for (const m of R.monsters) { if (!m.alive || m.region !== R.region) continue; const [x, y] = w2p(m.x, m.z); if (x < 0 || y < 0 || x > S || y > S) continue; ctx.fillStyle = m.def.boss ? "#ffcf4a" : "#ff4d3d"; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      for (const r of R.remotes.values()) { const [x, y] = w2p(r.x, r.z); ctx.fillStyle = R.party.has(r.id) ? "#7dd3fc" : "#ffffff"; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
      const [px, py] = w2p(R.x, R.z);
      ctx.fillStyle = "#3dff6b"; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = "#000"; ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [big]);
  useTick(500);
  const city = cityAt(R.x, R.z), zone = zoneAt(R.x, R.z);
  return (
    <div className={`panel pointer-events-auto p-1.5 ${big ? "fixed inset-4 z-40 m-auto h-fit w-fit" : ""}`}>
      <canvas ref={ref} width={big ? 520 : 150} height={big ? 520 : 150} onClick={onToggle}
        className={`block cursor-pointer rounded ${big ? "h-[min(80vw,80vh)] w-[min(80vw,80vh)]" : "h-[110px] w-[110px] md:h-[150px] md:w-[150px]"}`} />
      <div className="mt-1 text-center text-[10px] leading-tight">
        <div className={city ? "text-success" : zone?.kind === "pvp" ? "text-hp" : "text-parchment"}>
          {city ? `${city.name} · Zona protegida` : zone ? zone.name : "Terras selvagens"}
        </div>
        <div className="text-muted-foreground">{Math.round(R.x)}, {Math.round(R.z)}</div>
      </div>
    </div>
  );
}

export function Hotbar({ characterId }: { characterId: string }) {
  useTick(150);
  const me = useUI((s) => s.me);
  const setMe = useUI((s) => s.setMe);
  const potionCd = useRef(0);
  if (!me) return null;
  const v = VOCATIONS[me.vocation];
  const t = performance.now() / 1000;
  const cast = (i: number) => {
    const s = v.spells[i]; if (!s) return;
    const err = useSpell(s);
    if (err) R.log(err, "#ff8a7a");
  };
  const potion = async (id: string) => {
    if (potionCd.current > performance.now()) return;
    potionCd.current = performance.now() + 1000;
    const has = me.inventory.find((s) => s.id === id);
    if (!has) { R.log(`Você não tem ${ITEMS[id].name}.`, "#ff8a7a"); return; }
    try {
      const r = await useItem({ data: { id: characterId, item: id } });
      if (r.use.hp) R.hp = Math.min(maxHpMe(), R.hp + r.use.hp);
      if (r.use.mana) R.mana = Math.min(maxManaMe(), R.mana + r.use.mana);
      const cur = useUI.getState().me; if (cur) setMe({ ...cur, inventory: r.inventory });
    } catch (e) { toast.error((e as Error).message); }
  };
  (Hotbar as unknown as { cast: typeof cast; potion: typeof potion }).cast = cast;
  (Hotbar as unknown as { cast: typeof cast; potion: typeof potion }).potion = potion;
  const count = (id: string) => me.inventory.find((s) => s.id === id)?.qty ?? 0;
  return (
    <div className="panel pointer-events-auto flex gap-1 p-1.5">
      {v.spells.map((s, i) => {
        const cd = Math.max(0, (R.cooldowns[s.id] ?? 0) - t);
        const locked = me.level < s.minLevel;
        return (
          <button key={s.id} onClick={() => cast(i)} title={`${s.name} — ${s.desc} (${s.mana} mana)`}
            className={`slot relative flex h-12 w-12 flex-col items-center justify-center overflow-hidden md:h-14 md:w-14 ${locked ? "opacity-40" : ""}`}>
            <span className="h-5 w-5 rounded-full md:h-6 md:w-6" style={{ background: `radial-gradient(circle, ${s.color}, transparent 70%)`, boxShadow: `0 0 12px ${s.color}` }} />
            <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px] leading-none text-parchment md:text-[9px]">{s.name}</span>
            <span className="absolute left-0.5 top-0 text-[9px] text-primary">{s.key}</span>
            {cd > 0 && <span className="absolute inset-0 flex items-center justify-center bg-background/70 font-bold text-parchment">{Math.ceil(cd)}</span>}
            {R.mana < s.mana && cd === 0 && <span className="absolute inset-0 bg-mana/25" />}
          </button>
        );
      })}
      {(["pocao_vida", "pocao_mana"] as const).map((id, i) => (
        <button key={id} onClick={() => potion(id)} className="slot relative flex h-12 w-12 items-center justify-center text-xl md:h-14 md:w-14" title={ITEMS[id].name}>
          <span style={{ filter: `drop-shadow(0 0 6px ${ITEMS[id].color})` }}>{ITEMS[id].icon}</span>
          <span className="absolute left-0.5 top-0 text-[9px] text-primary">{5 + i}</span>
          <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-parchment">{count(id)}</span>
        </button>
      ))}
    </div>
  );
}
export const hotbarActions = Hotbar as unknown as { cast?: (i: number) => void; potion?: (id: string) => void };

const CH_COLORS: Record<ChatMsg["ch"], string> = { global: "text-primary", local: "text-parchment", system: "text-muted-foreground", party: "text-mana" };
export function Chat({ compact }: { compact: boolean }) {
  const chat = useUI((s) => s.chat);
  const [tab, setTab] = useState<"local" | "global" | "party">("local");
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { listRef.current?.scrollTo(0, 1e9); }, [chat, open]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" && document.activeElement !== inputRef.current) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = text.trim().slice(0, 200);
    if (!msg || !R.me) { inputRef.current?.blur(); return; }
    const push = useUI.getState().push;
    if (tab === "global") { R.sendGlobal("chat", { n: R.me.name, t: msg }); push({ ch: "global", from: R.me.name, text: msg }); }
    else if (tab === "party") { R.sendGlobal("pchat", { n: R.me.name, t: msg, members: [...R.party] }); push({ ch: "party", from: R.me.name, text: msg }); }
    else { R.send("chat", { n: R.me.name, t: msg }); push({ ch: "local", from: R.me.name, text: msg }); }
    setText("");
    inputRef.current?.blur();
  };
  const shown = chat.filter((m) => m.ch === "system" || m.ch === tab || (tab === "local" && m.ch !== "global" && m.ch !== "party")).slice(-60);
  if (!open) return <button className="panel pointer-events-auto px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>💬 Chat</button>;
  return (
    <div className="panel pointer-events-auto flex w-[min(92vw,340px)] flex-col p-1.5">
      <div className="mb-1 flex items-center gap-1 text-[11px]">
        {(["local", "global", "party"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t === "local" ? "Local" : t === "global" ? "Global" : "Party"}</button>
        ))}
        <button className="ml-auto px-1 text-muted-foreground" onClick={() => setOpen(false)}>–</button>
      </div>
      <div ref={listRef} className={`${compact ? "h-24" : "h-36"} space-y-0.5 overflow-y-auto pr-1 text-[12px] leading-snug`}>
        {shown.map((m) => (
          <div key={m.id} className={CH_COLORS[m.ch]} style={m.color ? { color: m.color } : undefined}>
            {m.from && <b>{m.from}: </b>}{m.text}
          </div>
        ))}
      </div>
      <form onSubmit={send}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Enter para conversar…"
          className="slot mt-1 w-full px-2 py-1 text-[12px] outline-none" onKeyDown={(e) => e.stopPropagation()} />
      </form>
    </div>
  );
}

const MENU: { p: Exclude<Panel, null | "npc">; icon: string; label: string; key?: string }[] = [
  { p: "inventory", icon: "🎒", label: "Inventário", key: "I" },
  { p: "character", icon: "🛡️", label: "Personagem", key: "C" },
  { p: "skills", icon: "📜", label: "Skills", key: "K" },
  { p: "quests", icon: "❗", label: "Missões", key: "Q" },
  { p: "look", icon: "👘", label: "Visual", key: "O" },
  { p: "party", icon: "👥", label: "Party", key: "P" },
  { p: "guild", icon: "🏰", label: "Guild", key: "G" },
  { p: "trade", icon: "⚖️", label: "Mercado", key: "T" },
  { p: "store", icon: "💎", label: "Loja", key: "L" },
];
export function MenuBar() {
  const setPanel = useUI((s) => s.setPanel);
  const online = useUI((s) => s.online);
  return (
    <div className="panel pointer-events-auto flex flex-wrap justify-end gap-1 p-1">
      {MENU.map((m) => (
        <button key={m.p} onClick={() => setPanel(m.p)} title={`${m.label}${m.key ? ` (${m.key})` : ""}`}
          className={`slot flex h-9 w-9 items-center justify-center text-base ${m.p === "store" ? "ring-1 ring-ring" : ""}`}>{m.icon}</button>
      ))}
      <span className="flex items-center px-1 text-[10px] text-success">● {online}</span>
    </div>
  );
}

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2; const l = Math.hypot(dx, dy);
    if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
    setKnob({ x: dx, y: dy });
    R.joy.x = dx / max; R.joy.z = dy / max;
  };
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); R.joy.x = 0; R.joy.z = 0; };
  return (
    <div ref={base} className="pointer-events-auto relative h-32 w-32 touch-none rounded-full border-2 border-border bg-background/40 backdrop-blur"
      onPointerDown={(e) => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-primary bg-primary/40 shadow-[var(--shadow-glow)]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

export function MobileActions() {
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <button className="btn-gold h-16 w-16 rounded-full text-2xl" onClick={() => { R.target = nearestEnemy(); if (!R.target) R.log("Nenhum inimigo por perto."); }}>⚔️</button>
    </div>
  );
}

export function useMinimapPrewarm() {
  useMemo(() => { if (typeof document !== "undefined") setTimeout(getMinimapBg, 500); }, []);
}
