// Server-only game authority. Every value that persists is computed here.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CITIES, ITEMS, MONSTERS, MONSTER_SPAWNS, OUTFITS, MOUNTS, PVP_RULES, QUESTS, STORE,
  VOCATIONS, cityAt, levelFromExp, maxHp, maxMana, mlReq, moveSpeed, skillReq,
  type VocationId,
} from "@/game/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = () => supabaseAdmin as any;

export type InvStack = { id: string; qty: number };
export type CharRow = {
  id: string; user_id: string; name: string; vocation: VocationId; home_city: string;
  level: number; exp: number; hp: number; mana: number; magic_level: number; ml_progress: number;
  skill_level: number; skill_progress: number; gold: number; bank: number; pos_x: number; pos_z: number;
  inventory: InvStack[]; equipment: Record<string, string>; outfit: string; mount: string | null;
  owned_outfits: string[]; owned_mounts: string[]; xp_boost_until: string | null; skull: string;
  skull_until: string | null; frags: number; deaths: number; monsters_killed: number; guild_id: string | null;
  quests: Record<string, { progress: number; done?: boolean }>; last_save: string; created_at: string;
};

export const MAX_STACKS = 40;

export async function getOwnedChar(userId: string, charId: string): Promise<CharRow> {
  const { data, error } = await db().from("characters").select("*").eq("id", charId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Personagem não encontrado");
  return normalize(data);
}

export function normalize(c: CharRow): CharRow {
  // expire skulls server-side
  if (c.skull !== "none" && c.skull_until && new Date(c.skull_until).getTime() < Date.now()) {
    c.skull = "none";
    c.skull_until = null;
  }
  c.exp = Number(c.exp); c.gold = Number(c.gold); c.bank = Number(c.bank);
  return c;
}

export async function save(id: string, patch: Partial<CharRow>) {
  const { data, error } = await db().from("characters").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export function addItem(inv: InvStack[], id: string, qty: number) {
  const s = inv.find((s) => s.id === id);
  if (s) s.qty += qty;
  else {
    if (inv.length >= MAX_STACKS) return false;
    inv.push({ id, qty });
  }
  return true;
}
export function removeItem(inv: InvStack[], id: string, qty: number) {
  const s = inv.find((s) => s.id === id);
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) inv.splice(inv.indexOf(s), 1);
  return true;
}

const rand = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));

export type SyncInput = {
  id: string; x: number; z: number; hp: number; mana: number;
  kills: { type: string; idx: number; share: number }[]; hits: number; manaSpent: number;
};

export async function applySync(userId: string, input: SyncInput) {
  const c = await getOwnedChar(userId, input.id);
  const now = Date.now();
  const dt = Math.max(1, Math.min(120, (now - new Date(c.last_save).getTime()) / 1000));
  const events: { type: string; text: string }[] = [];

  // --- movement validation (anti speedhack / teleport)
  let x = c.pos_x, z = c.pos_z;
  const dist = Math.hypot(input.x - c.pos_x, input.z - c.pos_z);
  const allowed = moveSpeed(c.level) * 1.45 * dt + 12;
  if (dist <= allowed) { x = input.x; z = input.z; }
  else events.push({ type: "warn", text: "Movimento inválido corrigido pelo servidor." });

  // --- kills (rate-limited + proximity checked)
  const maxKills = Math.ceil(dt / 1.2) + 2;
  const kills = input.kills.slice(0, maxKills);
  let exp = c.exp;
  let gold = c.gold;
  const inv = [...c.inventory];
  const quests = { ...c.quests };
  const boost = c.xp_boost_until && new Date(c.xp_boost_until).getTime() > now ? 1.5 : 1;
  let killed = 0;
  for (const k of kills) {
    const m = MONSTERS[k.type];
    const sp = MONSTER_SPAWNS[k.idx];
    if (!m || !sp || sp.type !== k.type) continue;
    if (Math.hypot(sp.x - x, sp.z - z) > 70) continue;
    const share = Math.max(1, Math.min(8, Math.floor(k.share || 1)));
    const partyBonus = share > 1 ? 1.15 : 1;
    const gained = Math.round((m.exp * boost * partyBonus) / share);
    exp += gained;
    killed++;
    const g = Math.round(rand(m.gold[0], m.gold[1]) / share);
    gold += g;
    const got: string[] = [];
    for (const l of m.loot) {
      if (Math.random() < l.chance / share && addItem(inv, l.item, 1)) got.push(ITEMS[l.item]?.name ?? l.item);
    }
    events.push({ type: "loot", text: `${m.name}: +${gained} exp, ${g} ouro${got.length ? ", " + got.join(", ") : ""}` });
    for (const q of QUESTS) {
      const st = quests[q.id];
      if (st && !st.done && q.monster === k.type) quests[q.id] = { ...st, progress: Math.min(q.count, st.progress + 1) };
    }
  }

  const prevLevel = c.level;
  const level = levelFromExp(exp);
  if (level > prevLevel) events.push({ type: "level", text: `Você avançou do nível ${prevLevel} para ${level}!` });

  // --- skill & magic level progression (capped by elapsed time)
  const hits = Math.max(0, Math.min(input.hits, Math.ceil(dt * 2) + 2));
  let sk = c.skill_level, skp = c.skill_progress + hits;
  while (skp >= skillReq(sk, c.vocation)) { skp -= skillReq(sk, c.vocation); sk++; events.push({ type: "skill", text: `${VOCATIONS[c.vocation].skillName} subiu para ${sk}!` }); }
  const mMax = maxMana(c.vocation, level);
  const manaSpent = Math.max(0, Math.min(input.manaSpent, mMax + dt * (mMax / 15) + 400));
  let ml = c.magic_level, mlp = c.ml_progress + manaSpent;
  while (mlp >= mlReq(ml, c.vocation)) { mlp -= mlReq(ml, c.vocation); ml++; events.push({ type: "skill", text: `Magic Level subiu para ${ml}!` }); }

  const hp = Math.max(1, Math.min(maxHp(c.vocation, level), Math.round(input.hp)));
  const mana = Math.max(0, Math.min(mMax, Math.round(input.mana)));

  const row = await save(c.id, {
    pos_x: x, pos_z: z, hp: level > prevLevel ? maxHp(c.vocation, level) : hp,
    mana: level > prevLevel ? mMax : mana, exp, level, gold, inventory: inv, quests,
    skill_level: sk, skill_progress: skp, magic_level: ml, ml_progress: mlp,
    monsters_killed: c.monsters_killed + killed, last_save: new Date(now).toISOString(),
  });
  return { character: row, events };
}

export async function applyDeath(userId: string, id: string, killerId?: string | null) {
  const c = await getOwnedChar(userId, id);
  const red = c.skull === "red";
  const lossPct = red ? PVP_RULES.expLossPct * 2 : PVP_RULES.expLossPct;
  const exp = Math.max(0, Math.floor(c.exp * (1 - lossPct)));
  const level = Math.max(1, levelFromExp(exp));
  const inv = c.inventory.filter(() => Math.random() >= (red ? PVP_RULES.redSkullItemLoss : PVP_RULES.itemLossChance));
  const home = CITIES.find((x) => x.id === c.home_city) ?? CITIES[0];
  const events: string[] = [`Você morreu e perdeu ${c.exp - exp} de experiência.`];
  if (inv.length < c.inventory.length) events.push(`Você perdeu ${c.inventory.length - inv.length} item(ns).`);

  // PvP: punish the killer for unjustified kills
  if (killerId && killerId !== id && !cityAt(c.pos_x, c.pos_z)) {
    const { data: k } = await db().from("characters").select("*").eq("id", killerId).maybeSingle();
    if (k && k.level >= PVP_RULES.protectionLevel && c.level >= PVP_RULES.protectionLevel) {
      if (c.skull === "none") {
        const frags = k.frags + 1;
        const toRed = frags >= PVP_RULES.redSkullFrags;
        const until = new Date(Date.now() + (toRed ? PVP_RULES.redSkullDays * 864e5 : PVP_RULES.whiteSkullMinutes * 6e4)).toISOString();
        await db().from("characters").update({ frags, skull: toRed ? "red" : "white", skull_until: until }).eq("id", killerId);
      }
      events.push(`Você foi morto por ${k.name}.`);
    }
  }

  const row = await save(c.id, {
    exp, level, inventory: inv, hp: maxHp(c.vocation, level), mana: maxMana(c.vocation, level),
    pos_x: home.x, pos_z: home.z + 4, deaths: c.deaths + 1, last_save: new Date().toISOString(),
    skull: red ? c.skull : "none", skull_until: red ? c.skull_until : null,
  });
  return { character: row, events };
}

export function grantStore(c: CharRow, itemId: string): Partial<CharRow> {
  const it = STORE.find((s) => s.id === itemId);
  if (!it) throw new Error("Item da loja inválido");
  const patch: Partial<CharRow> = {};
  if (it.grant.outfit && OUTFITS[it.grant.outfit]) patch.owned_outfits = Array.from(new Set([...c.owned_outfits, it.grant.outfit]));
  if (it.grant.mount && MOUNTS[it.grant.mount]) patch.owned_mounts = Array.from(new Set([...c.owned_mounts, it.grant.mount]));
  if (it.grant.xpBoostHours) {
    const base = c.xp_boost_until && new Date(c.xp_boost_until).getTime() > Date.now() ? new Date(c.xp_boost_until).getTime() : Date.now();
    patch.xp_boost_until = new Date(base + it.grant.xpBoostHours * 36e5).toISOString();
  }
  if (it.grant.gold) patch.bank = c.bank + it.grant.gold;
  if (it.grant.items) {
    const inv = [...c.inventory];
    for (const s of it.grant.items) addItem(inv, s.id, s.qty);
    patch.inventory = inv;
  }
  return patch;
}

/** Fulfils a purchase exactly once after Mercado Pago confirms it. */
export async function fulfilPurchase(purchaseId: string, paymentId: string) {
  const { data: p } = await db().from("purchases").select("*").eq("id", purchaseId).maybeSingle();
  if (!p || p.status === "approved") return false;
  // claim atomically: only one caller flips pending -> approved
  const { data: claimed } = await db().from("purchases")
    .update({ status: "approved", mp_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq("id", purchaseId).eq("status", "pending").select("id");
  if (!claimed?.length) return false;
  const { data: c } = await db().from("characters").select("*").eq("id", p.character_id).single();
  await db().from("characters").update(grantStore(normalize(c), p.item_id)).eq("id", p.character_id);
  return true;
}

export async function mpFetch(path: string, init?: RequestInit) {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) throw new Error("A loja ainda não está configurada (Mercado Pago).");
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mercado Pago: ${body?.message ?? res.status}`);
  return body;
}

/** Checks Mercado Pago for an approved payment of this purchase and fulfils it. */
export async function verifyPurchaseWithMP(purchaseId: string) {
  const r = await mpFetch(`/v1/payments/search?external_reference=${encodeURIComponent(purchaseId)}&sort=date_created&criteria=desc`);
  const approved = (r.results ?? []).find((p: { status: string }) => p.status === "approved");
  if (approved) return fulfilPurchase(purchaseId, String(approved.id));
  return false;
}
