// Server-only game authority. Every value that persists is computed here.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ARENA_MAPS, CITIES, ITEMS, MONSTERS, MONSTER_SPAWNS, OUTFITS, MOUNTS, PVP_RULES, QUESTS, STORE,
  VOCATIONS, cityAt, zoneAt, levelFromExp, maxHp, maxMana, mlReq, moveSpeed, skillReq,
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
   quests: Record<string, { progress: number; done?: boolean }>; tutorial_step: number; combat_until: string | null;
   arena_wins: number; arena_losses: number; arena_rating: number; last_save: string; created_at: string;
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
  kills: { type: string; idx: number; share: number }[]; hits: number; manaSpent: number; combatWith?: string | null;
};

export async function applySync(userId: string, input: SyncInput) {
  const c = await getOwnedChar(userId, input.id);
  const now = Date.now();
  const dt = Math.max(1, Math.min(120, (now - new Date(c.last_save).getTime()) / 1000));
  const events: { type: string; text: string }[] = [];
  let combatUntil = c.combat_until;
  if (input.combatWith) {
    const { data: opponent } = await db().from("characters").select("id,pos_x,pos_z").eq("id", input.combatWith).maybeSingle();
    if (opponent && Math.hypot(Number(opponent.pos_x) - c.pos_x, Number(opponent.pos_z) - c.pos_z) < 25) {
      combatUntil = new Date(now + 30_000).toISOString();
    }
  } else if (input.hits > 0 || input.kills.length > 0) {
    combatUntil = new Date(now + 15_000).toISOString();
  }

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
    monsters_killed: c.monsters_killed + killed, combat_until: combatUntil, last_save: new Date(now).toISOString(),
  });
  return { character: row, events };
}

export async function applyDeath(userId: string, id: string, killerId?: string | null) {
  const c = await getOwnedChar(userId, id);
  const red = c.skull === "red";
  const home0 = CITIES.find((x) => x.id === c.home_city) ?? CITIES[0];
  if (zoneAt(c.pos_x, c.pos_z)?.kind === "pvp") {
    const { data: matches } = await db().from("arena_matches").select("*").in("status", ["countdown", "active"]).order("created_at", { ascending: false }).limit(20);
    const match = (matches ?? []).find((m: { team_a: string[]; team_b: string[] }) => m.team_a.includes(c.id) || m.team_b.includes(c.id));
    if (match) {
      const loserSide = match.team_a.includes(c.id) ? "a" : "b";
      const winnerSide = loserSide === "a" ? "b" : "a";
      const winners: string[] = winnerSide === "a" ? match.team_a : match.team_b;
      const losers: string[] = loserSide === "a" ? match.team_a : match.team_b;
      const { data: claimed } = await db().from("arena_matches").update({ status: "finished", winner: winnerSide, ends_at: new Date().toISOString(), rewarded: true }).eq("id", match.id).neq("status", "finished").select("id");
      if (claimed?.length) {
        const reward = match.mode === "5v5" ? 700 : match.mode === "3v3" ? 500 : match.mode === "2v2" ? 350 : 250;
        for (const cid of winners) {
          const { data: w } = await db().from("characters").select("exp,gold,arena_wins,arena_rating").eq("id", cid).single();
          await db().from("characters").update({ exp: Number(w.exp) + reward, gold: Number(w.gold) + reward, arena_wins: w.arena_wins + 1, arena_rating: w.arena_rating + 18 }).eq("id", cid);
        }
        for (const cid of losers) {
          const { data: l } = await db().from("characters").select("arena_losses,arena_rating").eq("id", cid).single();
          await db().from("characters").update({ arena_losses: l.arena_losses + 1, arena_rating: Math.max(0, l.arena_rating - 12) }).eq("id", cid);
        }
      }
    }
    const row = await save(c.id, { hp: maxHp(c.vocation, c.level), mana: maxMana(c.vocation, c.level), pos_x: home0.x, pos_z: home0.z + 4, combat_until: null, last_save: new Date().toISOString() });
    return { character: row, events: [match ? "A rodada da Arena terminou. Resultado e recompensas foram registrados." : "Você caiu na Arena. Sem penalidades."] };
  }
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

export async function joinArena(userId: string, id: string, mode: "1v1" | "2v2" | "3v3" | "5v5") {
  const c = await getOwnedChar(userId, id);
  if (c.combat_until && new Date(c.combat_until).getTime() > Date.now()) throw new Error("Você não pode entrar na Arena durante o combate.");
  await db().from("arena_queue").upsert({ character_id: c.id, user_id: userId, mode, status: "queued", team_code: null }, { onConflict: "character_id" });
  const size = Number(mode[0]);
  const needed = size * 2;
  const { data: queued } = await db().from("arena_queue").select("*").eq("mode", mode).eq("status", "queued").order("created_at").limit(needed);
  if ((queued?.length ?? 0) >= needed) {
    const picked = queued.slice(0, needed);
    const teamA = picked.slice(0, size).map((q: { character_id: string }) => q.character_id);
    const teamB = picked.slice(size).map((q: { character_id: string }) => q.character_id);
    const map = ARENA_MAPS[Math.floor(Math.random() * ARENA_MAPS.length)];
    const startsAt = new Date(Date.now() + 10_000).toISOString();
    const { data: match } = await db().from("arena_matches").insert({ mode, map_id: map.id, team_a: teamA, team_b: teamB, starts_at: startsAt }).select("*").single();
    await db().from("arena_queue").update({ status: "matched" }).in("character_id", [...teamA, ...teamB]);
    for (const cid of teamA) await db().from("characters").update({ pos_x: map.a[0], pos_z: map.a[1] }).eq("id", cid);
    for (const cid of teamB) await db().from("characters").update({ pos_x: map.b[0], pos_z: map.b[1] }).eq("id", cid);
    return { state: "matched", match };
  }
  return { state: "queued", waiting: queued?.length ?? 1, needed };
}

export async function arenaStatus(userId: string, id: string) {
  const c = await getOwnedChar(userId, id);
  const { data: queue } = await db().from("arena_queue").select("*").eq("character_id", c.id).maybeSingle();
  const { data: matches } = await db().from("arena_matches").select("*").in("status", ["countdown", "active"]).order("created_at", { ascending: false }).limit(20);
  const match = (matches ?? []).find((m: { team_a: string[]; team_b: string[] }) => m.team_a.includes(c.id) || m.team_b.includes(c.id)) ?? null;
  if (match && match.status === "countdown" && new Date(match.starts_at).getTime() <= Date.now()) {
    const { data: active } = await db().from("arena_matches").update({ status: "active" }).eq("id", match.id).eq("status", "countdown").select("*").single();
    return { queue, match: active ?? match };
  }
  return { queue, match };
}

export async function leaveArenaQueue(userId: string, id: string) {
  const c = await getOwnedChar(userId, id);
  await db().from("arena_queue").delete().eq("character_id", c.id).eq("status", "queued");
  return { ok: true };
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
