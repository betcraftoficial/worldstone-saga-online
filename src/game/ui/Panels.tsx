import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ARENA_MODES, ITEMS, MOUNTS, OUTFITS, QUESTS, RARITIES, STORE, VOCATIONS, expForLevel, mlReq, skillReq, type ArenaMode, type Slot,
} from "../data";
import { R, maxHpMe, maxManaMe } from "../engine";
import { useUI } from "../store";
import { commit } from "./commit";
import {
  arenaAction, bankOp, checkPurchases, createCheckout, equipItem, guildAction, npcTrade, questAction, setLook, tradeAction, useItem,
} from "@/lib/game.functions";

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const setPanel = useUI((s) => s.setPanel);
  const panel = useUI((s) => s.panel);
  return (
    <div className="panel pointer-events-auto fixed inset-x-2 bottom-2 top-16 z-30 flex flex-col p-3 animate-fade-in md:inset-auto md:right-4 md:top-24 md:h-[min(75vh,640px)] md:w-[400px]"
      onKeyDown={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
        <h3 className="panel-title text-lg">{title}</h3>
        <button className="btn-wood px-2 py-0.5 text-sm" onClick={() => setPanel(panel)}>✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

async function run<T>(p: Promise<T>, ok?: string) {
  try { const r = await p; if (ok) toast.success(ok); return r; } catch (e) { toast.error((e as Error).message); return null; }
}

function ItemIcon({ id, qty, onClick, active }: { id: string; qty?: number; onClick?: () => void; active?: boolean }) {
  const it = ITEMS[id];
  const rarity = RARITIES[it?.rarity ?? "common"];
  return (
    <button onClick={onClick} title={it?.name} className={`slot relative flex aspect-square items-center justify-center border-2 text-xl ${active ? "ring-2 ring-ring" : ""}`} style={{ borderColor: rarity.color }}>
      <span style={{ filter: `drop-shadow(0 0 4px ${it?.color})` }}>{it?.icon ?? "?"}</span>
      {qty && qty > 1 ? <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-parchment">{qty}</span> : null}
    </button>
  );
}

function ItemDetail({ id }: { id: string }) {
  const it = ITEMS[id];
  if (!it) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <div className="font-display text-sm text-parchment">{it.name}</div>
      <div style={{ color: RARITIES[it.rarity ?? "common"].color }}>{RARITIES[it.rarity ?? "common"].name}</div>
      {it.atk ? <div>Ataque: {it.atk}</div> : null}
      {it.def ? <div>Defesa: {it.def}</div> : null}
      {it.use?.hp ? <div>Cura {it.use.hp} de vida</div> : null}
      {it.use?.mana ? <div>Restaura {it.use.mana} de mana</div> : null}
      {it.vocations ? <div>Vocações: {it.vocations.map((v) => VOCATIONS[v].name).join(", ")}</div> : null}
      {it.minLevel ? <div>Nível mínimo: {it.minLevel}</div> : null}
      {it.stats && Object.entries(it.stats).map(([stat, value]) => <div key={stat}>+{value} {({ vitality: "Vitalidade", defense: "Defesa", precision: "Precisão", rangedDamage: "Dano à distância", healing: "Cura", mana: "Mana", magicPower: "Poder mágico", agility: "Agilidade", critical: "Crítico" } as Record<string, string>)[stat]}</div>)}
      {it.sell ? <div>Vende por {it.sell} ouro</div> : null}
    </div>
  );
}

function Inventory() {
  const me = useUI((s) => s.me)!;
  const [sel, setSel] = useState<string | null>(null);
  const it = sel ? ITEMS[sel] : null;
  return (
    <Sheet title="Inventário">
      <div className="mb-2 flex justify-between text-sm"><span className="text-gold">🪙 {me.gold.toLocaleString("pt-BR")} ouro</span><span className="text-muted-foreground">Banco: {me.bank.toLocaleString("pt-BR")}</span></div>
      <div className="grid grid-cols-6 gap-1.5">
        {me.inventory.map((s) => <ItemIcon key={s.id} id={s.id} qty={s.qty} active={sel === s.id} onClick={() => setSel(s.id)} />)}
        {Array.from({ length: Math.max(0, 24 - me.inventory.length) }).map((_, i) => <div key={i} className="slot aspect-square" />)}
      </div>
      {it && sel && (
        <div className="slot mt-3 p-3">
          <ItemDetail id={sel} />
          <div className="mt-2 flex gap-2">
            {it.use && <button className="btn-gold px-3 py-1 text-sm" onClick={async () => {
              const r = await run(useItem({ data: { id: me.id, item: sel } }));
              if (r) { if (r.use.hp) R.hp = Math.min(maxHpMe(), R.hp + r.use.hp); if (r.use.mana) R.mana = Math.min(maxManaMe(), R.mana + r.use.mana); commit({ ...me, inventory: r.inventory }); }
            }}>Usar</button>}
            {it.slot && <button className="btn-gold px-3 py-1 text-sm" onClick={async () => { const r = await run(equipItem({ data: { id: me.id, item: sel } })); if (r) { commit(r); setSel(null); } }}>Equipar</button>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

const SLOTS: { s: Slot; label: string }[] = [
  { s: "helmet", label: "Cabeça" }, { s: "armor", label: "Corpo" }, { s: "legs", label: "Pernas" },
  { s: "boots", label: "Pés" }, { s: "weapon", label: "Arma" }, { s: "shield", label: "Escudo" },
];
function Character() {
  const me = useUI((s) => s.me)!;
  const v = VOCATIONS[me.vocation];
  return (
    <Sheet title="Personagem">
      <div className="mb-3">
        <div className="font-display text-xl text-parchment">{me.name}</div>
        <div className="text-sm text-muted-foreground">{v.name} — {v.title} · Nível {me.level}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map(({ s, label }) => {
          const id = me.equipment[s];
          return (
            <div key={s} className="text-center">
              <div className="text-[10px] text-muted-foreground">{label}</div>
              {id ? <ItemIcon id={id} onClick={async () => { const r = await run(equipItem({ data: { id: me.id, unequip: s } })); if (r) commit(r); }} /> : <div className="slot aspect-square" />}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Toque em um item equipado para removê-lo.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {[
          ["Vida", `${Math.round(R.hp)} / ${maxHpMe()}`], ["Mana", `${Math.round(R.mana)} / ${maxManaMe()}`],
          ["Experiência", me.exp.toLocaleString("pt-BR")], ["Próximo nível", (expForLevel(me.level + 1) - me.exp).toLocaleString("pt-BR")],
          ["Monstros mortos", me.monsters_killed], ["Mortes", me.deaths], ["Frags", me.frags], ["Skull", me.skull === "none" ? "Nenhuma" : me.skull],
        ].map(([k, val]) => <div key={k as string} className="slot px-2 py-1"><div className="text-[10px] text-muted-foreground">{k}</div><div className="text-parchment">{val}</div></div>)}
      </div>
    </Sheet>
  );
}

function Skills() {
  const me = useUI((s) => s.me)!;
  const v = VOCATIONS[me.vocation];
  const skPct = (me.skill_progress / skillReq(me.skill_level, me.vocation)) * 100;
  const mlPct = (me.ml_progress / mlReq(me.magic_level, me.vocation)) * 100;
  const Row = ({ name, level, pct }: { name: string; level: number; pct: number }) => (
    <div className="slot p-2">
      <div className="flex justify-between text-sm"><span>{name}</span><b className="text-primary">{level}</b></div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-background"><div className="h-full bg-xp" style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="text-right text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
    </div>
  );
  return (
    <Sheet title="Skills & Magias">
      <div className="space-y-2">
        <Row name="Nível" level={me.level} pct={((me.exp - expForLevel(me.level)) / (expForLevel(me.level + 1) - expForLevel(me.level))) * 100} />
        <Row name={`Skill de ${v.skillName}`} level={me.skill_level} pct={skPct} />
        <Row name="Magic Level" level={me.magic_level} pct={mlPct} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">A skill sobe atacando criaturas. Magic Level sobe gastando mana{me.vocation === "druid" || me.vocation === "sorcerer" ? " — muito mais rápido para magos." : "."}</p>
      <h4 className="mt-4 font-display text-primary">Passiva: {v.passive.name}</h4>
      <p className="text-sm text-muted-foreground">{v.passive.desc}</p>
      <h4 className="mt-4 font-display text-primary">Magias</h4>
      <p className="mt-1 text-[11px] text-muted-foreground">As dez teclas 1–0 combinam ataque, magias e poções. Novas magias entram automaticamente ao desbloquear.</p>
      <div className="mt-1 space-y-1.5">
        {v.spells.map((s) => (
          <div key={s.id} className={`slot flex items-start gap-2 p-2 ${me.level < s.minLevel ? "opacity-50" : ""}`}>
            <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
            <div className="text-sm">
              <div className="text-parchment">[{s.key}] {s.name} <span className="text-[11px] text-muted-foreground">· {s.mana} mana · {s.cooldown}s · nv {s.minLevel}</span></div>
              <div className="text-[12px] text-muted-foreground">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Arena() {
  const me = useUI((s) => s.me)!;
  const [mode, setMode] = useState<ArenaMode>("1v1");
  const [state, setState] = useState<{ queue?: { status: string; mode: string } | null; match?: { mode: string; map_id: string; status: string; starts_at: string } | null; waiting?: number; needed?: number }>({});
  const refresh = async () => { const r = await run(arenaAction({ data: { id: me.id, op: "status" } })); if (r && "match" in r) setState(r); };
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 4000); return () => clearInterval(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet title="Arena PvP">
    <div className="slot mb-3 p-3 text-sm">
      <div className="font-display text-primary">Registro de combate</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center"><div><b>{me.arena_wins}</b><small className="block text-muted-foreground">Vitórias</small></div><div><b>{me.arena_losses}</b><small className="block text-muted-foreground">Derrotas</small></div><div><b>{me.arena_rating}</b><small className="block text-muted-foreground">Rating</small></div></div>
    </div>
    {state.match ? <div className="slot border-primary p-3"><b className="text-primary">Partida {state.match.mode}</b><p className="text-sm">Mapa: {state.match.map_id} · {state.match.status === "countdown" ? "Preparando combate" : "Em andamento"}</p><p className="mt-1 text-xs text-muted-foreground">Derrote a equipe adversária. A morte encerra a rodada sem perda de itens.</p></div> : state.queue?.status === "queued" ? <div className="slot p-3 text-center"><div className="animate-pulse font-display text-primary">Buscando combatentes…</div><p className="text-sm text-muted-foreground">Modo {state.queue.mode}</p><button className="btn-wood mt-3 px-4 py-1" onClick={async () => { await run(arenaAction({ data: { id: me.id, op: "leave" } })); await refresh(); }}>Sair da fila</button></div> : <>
      <p className="mb-3 text-sm text-muted-foreground">Escolha o tamanho da equipe. A partida começa quando todos os combatentes forem encontrados.</p>
      <div className="grid grid-cols-2 gap-2">{ARENA_MODES.map((m) => <button key={m} className={mode === m ? "btn-gold py-3" : "btn-wood py-3"} onClick={() => setMode(m)}>{m}</button>)}</div>
      <button className="btn-gold mt-4 w-full py-2" onClick={async () => { const r = await run(arenaAction({ data: { id: me.id, op: "join", mode } }), "Você entrou na fila da Arena."); if (r) { if ("match" in r || "waiting" in r) setState(r); window.dispatchEvent(new Event("eldrath:reload")); } }}>Entrar na fila {mode}</button>
    </>}
    <div className="mt-4 text-xs text-muted-foreground">Vitórias concedem XP, ouro e rating. Derrotas reduzem apenas rating. PK e penalidades comuns ficam desativados dentro da Arena.</div>
  </Sheet>;
}

function Quests() {
  const me = useUI((s) => s.me)!;
  const active = QUESTS.filter((q) => me.quests[q.id]);
  return (
    <Sheet title="Missões">
      {active.length === 0 && <p className="text-sm text-muted-foreground">Fale com os NPCs de missão (marcador azul) nas cidades.</p>}
      <div className="space-y-2">
        {active.map((q) => {
          const st = me.quests[q.id];
          return (
            <div key={q.id} className="slot p-2 text-sm">
              <div className="flex justify-between"><b className="text-parchment">{q.name}</b>{st.done ? <span className="text-success">Concluída</span> : <span className="text-primary">{st.progress}/{q.count}</span>}</div>
              <div className="text-[12px] text-muted-foreground">{q.desc}</div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function Npc() {
  const npc = useUI((s) => s.npc);
  const me = useUI((s) => s.me)!;
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState(100);
  if (!npc) return null;
  return (
    <Sheet title={npc.name}>
      {npc.role === "shop" && (
        <>
          <div className="mb-2 flex items-center justify-between text-sm"><span className="text-gold">🪙 {me.gold.toLocaleString("pt-BR")}</span>
            <label className="flex items-center gap-1 text-xs">Qtd <input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(100, +e.target.value || 1)))} className="slot w-14 px-1" /></label></div>
          <h4 className="font-display text-primary">Comprar</h4>
          <div className="space-y-1">
            {npc.sells?.map((id) => (
              <div key={id} className="slot flex items-center gap-2 p-1.5">
                <span className="text-lg">{ITEMS[id].icon}</span>
                <div className="flex-1 text-sm"><div className="text-parchment">{ITEMS[id].name}</div><div className="text-[11px] text-muted-foreground">{ITEMS[id].price} ouro{ITEMS[id].minLevel ? ` · nv ${ITEMS[id].minLevel}` : ""}</div></div>
                <button className="btn-gold px-2 py-0.5 text-xs" onClick={async () => { const r = await run(npcTrade({ data: { id: me.id, npc: npc.id, item: id, qty, op: "buy" } })); if (r) commit(r); }}>Comprar</button>
              </div>
            ))}
          </div>
          <h4 className="mt-3 font-display text-primary">Vender</h4>
          <div className="space-y-1">
            {me.inventory.filter((s) => ITEMS[s.id]?.sell > 0).map((s) => (
              <div key={s.id} className="slot flex items-center gap-2 p-1.5">
                <span className="text-lg">{ITEMS[s.id].icon}</span>
                <div className="flex-1 text-sm"><div className="text-parchment">{ITEMS[s.id].name} ×{s.qty}</div><div className="text-[11px] text-muted-foreground">{ITEMS[s.id].sell} ouro cada</div></div>
                <button className="btn-wood px-2 py-0.5 text-xs" onClick={async () => { const r = await run(npcTrade({ data: { id: me.id, npc: npc.id, item: s.id, qty: Math.min(qty, s.qty), op: "sell" } })); if (r) commit(r); }}>Vender</button>
              </div>
            ))}
          </div>
        </>
      )}
      {npc.role === "bank" && (
        <div className="space-y-3">
          <p className="text-sm">Seu ouro fica seguro no banco — você não perde ao morrer.</p>
          <div className="grid grid-cols-2 gap-2 text-sm"><div className="slot p-2">Na bolsa<br /><b className="text-gold">{me.gold.toLocaleString("pt-BR")}</b></div><div className="slot p-2">No banco<br /><b className="text-gold">{me.bank.toLocaleString("pt-BR")}</b></div></div>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, +e.target.value || 1))} className="slot w-full px-2 py-1.5" />
          <div className="flex gap-2">
            <button className="btn-gold flex-1 py-1.5" onClick={async () => { const r = await run(bankOp({ data: { id: me.id, op: "deposit", amount } })); if (r) commit(r); }}>Depositar</button>
            <button className="btn-wood flex-1 py-1.5" onClick={async () => { const r = await run(bankOp({ data: { id: me.id, op: "withdraw", amount } })); if (r) commit(r); }}>Sacar</button>
          </div>
          <button className="btn-wood w-full py-1" onClick={async () => { if (me.gold > 0) { const r = await run(bankOp({ data: { id: me.id, op: "deposit", amount: me.gold } })); if (r) commit(r); } }}>Depositar tudo</button>
        </div>
      )}
      {npc.role === "quest" && (
        <div className="space-y-2">
          {QUESTS.filter((q) => q.giver === npc.id).map((q) => {
            const st = me.quests[q.id];
            return (
              <div key={q.id} className="slot p-2 text-sm">
                <div className="flex justify-between"><b className="text-parchment">{q.name}</b>{st && <span className="text-primary">{st.done ? "✔" : `${st.progress}/${q.count}`}</span>}</div>
                <div className="text-[12px] text-muted-foreground">{q.desc} Recompensa: {q.reward.exp} exp, {q.reward.gold} ouro{q.reward.item ? `, ${ITEMS[q.reward.item].name}` : ""}.</div>
                {!st && <button className="btn-gold mt-1 px-2 py-0.5 text-xs" onClick={async () => { const r = await run(questAction({ data: { id: me.id, quest: q.id, op: "accept" } }), "Missão aceita!"); if (r) commit(r); }}>Aceitar</button>}
                {st && !st.done && st.progress >= q.count && <button className="btn-gold mt-1 px-2 py-0.5 text-xs" onClick={async () => { const r = await run(questAction({ data: { id: me.id, quest: q.id, op: "complete" } }), "Missão concluída!"); if (r) commit(r); }}>Entregar</button>}
              </div>
            );
          })}
        </div>
      )}
      {npc.role === "outfit" && <LookContent shop />}
    </Sheet>
  );
}

function LookContent({ shop }: { shop?: boolean }) {
  const me = useUI((s) => s.me)!;
  const setPanel = useUI((s) => s.setPanel);
  return (
    <>
      <h4 className="font-display text-primary">Outfits</h4>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(OUTFITS).map((o) => {
          const owned = me.owned_outfits.includes(o.id);
          if (!owned && !shop && !o.premium) return null;
          return (
            <div key={o.id} className={`slot p-2 text-sm ${me.outfit === o.id ? "ring-2 ring-ring" : ""}`}>
              <div className="mb-1 flex gap-1">{[o.body, o.trim, o.head, o.cape].filter(Boolean).map((c, i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: c }} />)}</div>
              <div className="text-parchment">{o.name}</div>
              {o.premium && <div className="text-[10px] text-primary">Premium · efeito {o.effect}</div>}
              {owned ? (
                <button className="btn-wood mt-1 w-full py-0.5 text-xs" onClick={async () => { const r = await run(setLook({ data: { id: me.id, outfit: o.id } })); if (r) commit(r); }}>{me.outfit === o.id ? "Usando" : "Usar"}</button>
              ) : o.premium ? (
                <button className="btn-gold mt-1 w-full py-0.5 text-xs" onClick={() => setPanel("store")}>Ver na loja</button>
              ) : (
                <button className="btn-gold mt-1 w-full py-0.5 text-xs" onClick={async () => { const r = await run(setLook({ data: { id: me.id, outfit: o.id, buy: true } }), "Outfit comprada!"); if (r) commit(r); }}>{o.goldPrice} ouro</button>
              )}
            </div>
          );
        })}
      </div>
      <h4 className="mt-3 font-display text-primary">Montarias</h4>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(MOUNTS).map((m) => {
          const owned = me.owned_mounts.includes(m.id);
          if (!owned && !shop && !m.premium) return null;
          return (
            <div key={m.id} className={`slot p-2 text-sm ${me.mount === m.id ? "ring-2 ring-ring" : ""}`}>
              <div className="text-parchment">{m.name}</div>
              <div className="text-[10px] text-muted-foreground">+{Math.round(m.speed * 100)}% velocidade</div>
              {owned ? (
                <button className="btn-wood mt-1 w-full py-0.5 text-xs" onClick={async () => { const r = await run(setLook({ data: { id: me.id, mount: me.mount === m.id ? null : m.id } })); if (r) commit(r); }}>{me.mount === m.id ? "Desmontar" : "Montar"}</button>
              ) : m.premium ? (
                <button className="btn-gold mt-1 w-full py-0.5 text-xs" onClick={() => setPanel("store")}>Ver na loja</button>
              ) : (
                <button className="btn-gold mt-1 w-full py-0.5 text-xs" onClick={async () => { const r = await run(setLook({ data: { id: me.id, mount: m.id, buy: true } }), "Montaria comprada!"); if (r) commit(r); }}>{m.goldPrice?.toLocaleString("pt-BR")} ouro</button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Store() {
  const me = useUI((s) => s.me)!;
  const [busy, setBusy] = useState<string | null>(null);
  const boost = me.xp_boost_until && new Date(me.xp_boost_until).getTime() > Date.now();
  return (
    <Sheet title="Loja Premium">
      <p className="mb-2 text-xs text-muted-foreground">Pagamento seguro via Mercado Pago (Pix, cartão ou boleto). Os itens chegam automaticamente após a aprovação.</p>
      {boost && <div className="slot mb-2 p-2 text-xs text-xp">Bônus de XP ativo até {new Date(me.xp_boost_until!).toLocaleString("pt-BR")}</div>}
      <div className="grid grid-cols-2 gap-2">
        {STORE.map((s) => (
          <div key={s.id} className="slot relative flex flex-col p-2">
            {s.badge && <span className="absolute right-1 top-1 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground">{s.badge}</span>}
            <div className="pr-8 font-display text-sm text-parchment">{s.name}</div>
            <div className="flex-1 text-[11px] text-muted-foreground">{s.desc}</div>
            <button disabled={busy === s.id} className="btn-gold mt-2 py-1 text-sm" onClick={async () => {
              setBusy(s.id);
              const r = await run(createCheckout({ data: { id: me.id, itemId: s.id } }));
              setBusy(null);
              if (r) { window.open(r.url, "_blank", "noopener"); toast.info("Finalize o pagamento na aba do Mercado Pago e depois toque em 'Verificar pagamentos'."); }
            }}>R$ {s.priceBRL.toFixed(2).replace(".", ",")}</button>
          </div>
        ))}
      </div>
      <button className="btn-wood mt-3 w-full py-2" onClick={async () => {
        const r = await run(checkPurchases({ data: { id: me.id } }));
        if (r) { if (r.granted) { toast.success(`${r.granted} compra(s) entregue(s)!`); window.dispatchEvent(new Event("eldrath:reload")); } else toast.message("Nenhum pagamento aprovado ainda."); }
      }}>Verificar pagamentos</button>
    </Sheet>
  );
}

function Party() {
  useUI((s) => s.partyVersion);
  const roster = useUI((s) => s.roster);
  const me = useUI((s) => s.me)!;
  const others = roster.filter((r) => r.id !== me.id);
  return (
    <Sheet title="Party">
      <h4 className="font-display text-primary">Membros</h4>
      {R.party.size === 0 && <p className="text-sm text-muted-foreground">Você está sozinho. Convide jogadores próximos — a experiência é dividida com +15% de bônus.</p>}
      <div className="space-y-1">
        {[...R.party].map((id) => {
          const r = R.remotes.get(id);
          return <div key={id} className="slot flex justify-between p-2 text-sm"><span className="text-mana">{r?.name ?? "Longe"}</span><span>{r ? `${r.hp}%` : "—"}</span></div>;
        })}
      </div>
      {R.party.size > 0 && <button className="btn-wood mt-2 w-full py-1 text-sm" onClick={() => { R.sendGlobal("pleave", { f: me.id }); R.party.clear(); useUI.getState().bumpParty(); }}>Sair da party</button>}
      <h4 className="mt-4 font-display text-primary">Jogadores na região</h4>
      <div className="space-y-1">
        {others.length === 0 && <p className="text-sm text-muted-foreground">Ninguém por perto.</p>}
        {others.map((o) => (
          <div key={o.id} className="slot flex items-center justify-between p-2 text-sm">
            <span>{o.name}</span>
            {!R.party.has(o.id) && <button className="btn-gold px-2 py-0.5 text-xs" onClick={() => { R.sendGlobal("pinv", { to: o.id, f: me.id, n: me.name }); toast.success(`Convite enviado para ${o.name}`); }}>Convidar</button>}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Guild() {
  const me = useUI((s) => s.me)!;
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const reload = () => window.dispatchEvent(new Event("eldrath:reload"));
  return (
    <Sheet title="Guild">
      {me.guild_id ? (
        <div className="space-y-2">
          <p>Você é membro de <b className="text-primary">[{me.guildTag}]</b>.</p>
          <button className="btn-wood w-full py-1.5" onClick={async () => { const r = await run(guildAction({ data: { id: me.id, op: "leave" } })); if (r) { commit(r, null); } }}>Sair da guild</button>
        </div>
      ) : (
        <div className="space-y-3">
          <input className="slot w-full px-2 py-1.5" placeholder="Nome da guild" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          <input className="slot w-full px-2 py-1.5" placeholder="Tag (2-4 letras)" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={4} />
          <button className="btn-gold w-full py-1.5" onClick={async () => { const r = await run(guildAction({ data: { id: me.id, op: "create", name, tag } }), "Guild fundada!"); if (r) reload(); }}>Fundar (1000 ouro · nível 10)</button>
          <button className="btn-wood w-full py-1.5" onClick={async () => { const r = await run(guildAction({ data: { id: me.id, op: "join", name } }), "Bem-vindo à guild!"); if (r) reload(); }}>Entrar na guild pelo nome</button>
        </div>
      )}
    </Sheet>
  );
}

type TradeRow = { id: string; from_character: string; to_character: string; item_id: string; qty: number; price: number; from?: { name: string }; to?: { name: string } };
function Trade() {
  const me = useUI((s) => s.me)!;
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [to, setTo] = useState("");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const load = async () => { const r = await run(tradeAction({ data: { id: me.id, op: "list" } })); if (r && "trades" in r) setRows(r.trades as TradeRow[]); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = () => window.dispatchEvent(new Event("eldrath:reload"));
  return (
    <Sheet title="Mercado entre jogadores">
      <p className="mb-2 text-xs text-muted-foreground">O item fica guardado pelo servidor até o comprador aceitar. O ouro vai direto para o banco do vendedor.</p>
      <div className="slot space-y-2 p-2">
        <input className="slot w-full px-2 py-1 text-sm" placeholder="Nome do comprador" value={to} onChange={(e) => setTo(e.target.value)} maxLength={18} />
        <select className="slot w-full px-2 py-1 text-sm" value={item} onChange={(e) => setItem(e.target.value)}>
          <option value="">Escolha o item…</option>
          {me.inventory.map((s) => <option key={s.id} value={s.id}>{ITEMS[s.id]?.name} (×{s.qty})</option>)}
        </select>
        <div className="flex gap-2">
          <input type="number" min={1} className="slot w-20 px-2 py-1 text-sm" value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} />
          <input type="number" min={0} className="slot flex-1 px-2 py-1 text-sm" placeholder="Preço em ouro" value={price} onChange={(e) => setPrice(Math.max(0, +e.target.value || 0))} />
        </div>
        <button className="btn-gold w-full py-1 text-sm" onClick={async () => { const r = await run(tradeAction({ data: { id: me.id, op: "offer", to, item, qty, price } }), "Oferta enviada!"); if (r) { reload(); load(); } }}>Enviar oferta</button>
      </div>
      <h4 className="mt-3 font-display text-primary">Ofertas abertas</h4>
      <div className="space-y-1">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma oferta.</p>}
        {rows.map((t) => {
          const incoming = t.to_character === me.id;
          return (
            <div key={t.id} className="slot p-2 text-sm">
              <div>{incoming ? `${t.from?.name} oferece` : `Para ${t.to?.name}:`} <b className="text-parchment">{ITEMS[t.item_id]?.name} ×{t.qty}</b> por <b className="text-gold">{Number(t.price).toLocaleString("pt-BR")}</b></div>
              <div className="mt-1 flex gap-2">
                {incoming && <button className="btn-gold px-2 py-0.5 text-xs" onClick={async () => { const r = await run(tradeAction({ data: { id: me.id, op: "accept", tradeId: t.id } }), "Troca concluída!"); if (r) { reload(); load(); } }}>Aceitar</button>}
                <button className="btn-wood px-2 py-0.5 text-xs" onClick={async () => { const r = await run(tradeAction({ data: { id: me.id, op: "cancel", tradeId: t.id } })); if (r) { reload(); load(); } }}>{incoming ? "Recusar" : "Cancelar"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function Panels() {
  const panel = useUI((s) => s.panel);
  const me = useUI((s) => s.me);
  if (!me || !panel) return null;
  switch (panel) {
    case "inventory": return <Inventory />;
    case "character": return <Character />;
    case "skills": return <Skills />;
    case "quests": return <Quests />;
    case "npc": return <Npc />;
    case "look": return <Sheet title="Visual"><LookContent /></Sheet>;
    case "store": return <Store />;
    case "party": return <Party />;
    case "guild": return <Guild />;
    case "trade": return <Trade />;
    case "arena": return <Arena />;
    default: return null;
  }
}
