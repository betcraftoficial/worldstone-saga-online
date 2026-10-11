import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ARENA_MODES, CITIES, ITEMS, MOUNTS, OUTFITS, QUESTS, STORE, VOCATIONS, maxHp, maxMana,
  type Slot, type VocationId,
} from "@/game/data";
import {
  addItem, applyDeath, applySync, arenaAttack, arenaStatus, db, dropItem, getOwnedChar, joinArena, leaveArenaQueue, mpFetch, nearbyDrops, pickDrop, removeItem, save, verifyPurchaseWithMP,
} from "./game.server";

const charId = z.object({ id: z.string().uuid() });
const auth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);
const characterNameSchema = z.string()
  .transform((value) => value.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(3, "O nome precisa ter pelo menos 3 letras.").max(18, "O nome pode ter no máximo 18 caracteres.")
    .regex(/^\p{L}+(?:[ '-]\p{L}+)*$/u, "Use apenas letras, espaços, apóstrofo ou hífen."));

export const listCharacters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await db().from("characters").select("id,name,vocation,level,outfit,home_city").eq("user_id", context.userId).order("created_at");
    return data ?? [];
  });

export const createCharacter = auth
  .inputValidator((d) => {
    const result = z.object({
      name: characterNameSchema,
      vocation: z.enum(["knight", "paladin", "druid", "sorcerer", "rogue"]),
    }).safeParse(d);
    if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Confira o nome do personagem.");
    return result.data;
  })
  .handler(async ({ data, context }) => {
    const { count } = await db().from("characters").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    if ((count ?? 0) >= 5) throw new Error("Máximo de 5 personagens por conta.");
    const v = data.vocation as VocationId;
    const name = data.name.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    const { data: row, error } = await db().from("characters").insert({
      user_id: context.userId, name, vocation: v, hp: maxHp(v, 1), mana: maxMana(v, 1),
      pos_x: Math.round((Math.random() * 12 - 6) * 10) / 10, pos_z: Math.round((4 + Math.random() * 6) * 10) / 10,
      equipment: { weapon: VOCATIONS[v].starterWeapon, armor: "peitoral_couro" },
      inventory: [{ id: "pocao_vida", qty: 5 }, { id: "pocao_mana", qty: 5 }],
      owned_outfits: ["aventureiro", `${v}_livre`],
    }).select("id").single();
    if (error) throw new Error(error.message.includes("duplicate") ? "Esse nome já existe." : error.message);
    return row;
  });

export const loadCharacter = auth.inputValidator((d) => charId.parse(d)).handler(async ({ data, context }) => {
  const c = await getOwnedChar(context.userId, data.id);
  const row = await save(c.id, { last_save: new Date().toISOString(), skull: c.skull, skull_until: c.skull_until });
  let guild: { name: string; tag: string } | null = null;
  if (row.guild_id) {
    const { data: g } = await db().from("guilds").select("name,tag").eq("id", row.guild_id).maybeSingle();
    guild = g;
  }
  return { character: row, guild };
});

export const syncProgress = auth
  .inputValidator((d) => z.object({
    id: z.string().uuid(), x: z.number().finite(), z: z.number().finite(),
    hp: z.number().finite(), mana: z.number().finite(),
    kills: z.array(z.object({ type: z.string().max(40), idx: z.number().int().min(0), share: z.number().int().min(1).max(8) })).max(30),
    hits: z.number().int().min(0).max(500), manaSpent: z.number().min(0).max(100000), combatWith: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => applySync(context.userId, data));

export const reportDeath = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), killerId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => applyDeath(context.userId, data.id, data.killerId));

export const tutorialProgress = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), step: z.number().int().min(0).max(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    if (data.step > c.tutorial_step + 1) throw new Error("Complete a etapa atual primeiro.");
    return save(c.id, { tutorial_step: Math.max(c.tutorial_step, data.step) });
  });

export const arenaAction = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), op: z.enum(["join", "leave", "status"]), mode: z.enum(ARENA_MODES).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.op === "join") {
      if (!data.mode) throw new Error("Escolha um modo de Arena.");
      return joinArena(context.userId, data.id, data.mode);
    }
    if (data.op === "leave") return leaveArenaQueue(context.userId, data.id);
    return arenaStatus(context.userId, data.id);
  });

export const arenaCombat = auth
  .inputValidator((d) => z.object({ id:z.string().uuid(), target:z.string().uuid(), spell:z.string().max(40).optional() }).parse(d))
  .handler(async ({data,context}) => arenaAttack(context.userId,data.id,data.target,data.spell));

export const deathDropSetting = auth
  .inputValidator((d) => z.object({id:z.string().uuid(), enabled:z.boolean()}).parse(d))
  .handler(async ({data,context}) => {
    const c=await getOwnedChar(context.userId,data.id);
    if (c.combat_until && Date.parse(c.combat_until)>Date.now()) throw new Error("Altere esta opção fora de combate.");
    return save(c.id,{death_drop_enabled:data.enabled});
  });

export const npcTrade = auth
  .inputValidator((d) => z.object({
    id: z.string().uuid(), npc: z.string(), item: z.string(), qty: z.number().int().min(1).max(100), op: z.enum(["buy", "sell"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const npc = CITIES.flatMap((ct) => ct.npcs.map((n) => ({ ...n, cx: ct.x, cz: ct.z }))).find((n) => n.id === data.npc);
    if (!npc || npc.role !== "shop") throw new Error("NPC inválido");
    if (Math.hypot(npc.cx + npc.dx - c.pos_x, npc.cz + npc.dz - c.pos_z) > 25) throw new Error("Você está longe do NPC.");
    const it = ITEMS[data.item];
    if (!it) throw new Error("Item inválido");
    const inv = [...c.inventory];
    let gold = c.gold;
    if (data.op === "buy") {
      if (!npc.sells?.includes(it.id) || it.price <= 0) throw new Error("Esse NPC não vende isso.");
      const cost = it.price * data.qty;
      if (gold < cost) throw new Error("Ouro insuficiente.");
      if (!addItem(inv, it.id, data.qty)) throw new Error("Inventário cheio.");
      gold -= cost;
    } else {
      if (it.sell <= 0) throw new Error("O NPC não compra isso.");
      if (!removeItem(inv, it.id, data.qty)) throw new Error("Você não tem esse item.");
      gold += it.sell * data.qty;
    }
    return save(c.id, { inventory: inv, gold });
  });

export const useItem = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), item: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const it = ITEMS[data.item];
    if (!it?.use) throw new Error("Item não utilizável");
    const inv = [...c.inventory];
    if (!removeItem(inv, it.id, 1)) throw new Error("Você não tem esse item.");
    await save(c.id, { inventory: inv });
    return { use: it.use, inventory: inv };
  });

export const groundDropAction = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), op: z.enum(["list", "drop", "pick"]), item: z.string().optional(), qty: z.number().int().min(1).max(1000).optional(), dropId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.op === "list") return { drops: await nearbyDrops(context.userId, data.id) };
    if (data.op === "drop") {
      if (!data.item) throw new Error("Escolha um item.");
      return dropItem(context.userId, data.id, data.item, data.qty ?? 1);
    }
    if (!data.dropId) throw new Error("Item no chão inválido.");
    return { character: await pickDrop(context.userId, data.id, data.dropId) };
  });

export const equipItem = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), item: z.string().optional(), unequip: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const inv = [...c.inventory];
    const eq = { ...c.equipment };
    if (data.unequip) {
      const cur = eq[data.unequip];
      if (!cur) throw new Error("Nada equipado");
      if (!addItem(inv, cur, 1)) throw new Error("Inventário cheio.");
      delete eq[data.unequip];
    } else if (data.item) {
      const it = ITEMS[data.item];
      if (!it?.slot) throw new Error("Não equipável");
      if (it.vocations && !it.vocations.includes(c.vocation)) throw new Error("Sua vocação não pode usar isso.");
      if (it.minLevel && c.level < it.minLevel) throw new Error(`Requer nível ${it.minLevel}.`);
      if (!removeItem(inv, it.id, 1)) throw new Error("Você não tem esse item.");
      const slot = it.slot as Slot;
      if (eq[slot]) addItem(inv, eq[slot], 1);
      eq[slot] = it.id;
    }
    return save(c.id, { inventory: inv, equipment: eq });
  });

export const bankOp = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), op: z.enum(["deposit", "withdraw"]), amount: z.number().int().min(1).max(1e12) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const nearBank = CITIES.some((ct) => ct.npcs.some((n) => n.role === "bank" && Math.hypot(ct.x + n.dx - c.pos_x, ct.z + n.dz - c.pos_z) < 25));
    if (!nearBank) throw new Error("Vá até um banqueiro.");
    if (data.op === "deposit") {
      if (c.gold < data.amount) throw new Error("Ouro insuficiente.");
      return save(c.id, { gold: c.gold - data.amount, bank: c.bank + data.amount });
    }
    if (c.bank < data.amount) throw new Error("Saldo insuficiente.");
    return save(c.id, { gold: c.gold + data.amount, bank: c.bank - data.amount });
  });

export const setLook = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), outfit: z.string().optional(), mount: z.string().nullable().optional(), buy: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const patch: Record<string, unknown> = {};
    let gold = c.gold;
    const owned = [...c.owned_outfits];
    const ownedM = [...c.owned_mounts];
    if (data.outfit) {
      const o = OUTFITS[data.outfit];
      if (!o) throw new Error("Outfit inválida");
      if (!owned.includes(o.id)) {
        if (!data.buy || !o.goldPrice) throw new Error(o.premium ? "Disponível na Loja Premium." : "Você não possui essa outfit.");
        if (gold < o.goldPrice) throw new Error("Ouro insuficiente.");
        gold -= o.goldPrice; owned.push(o.id);
      }
      patch.outfit = o.id;
    }
    if (data.mount !== undefined) {
      if (data.mount === null) patch.mount = null;
      else {
        const m = MOUNTS[data.mount];
        if (!m) throw new Error("Montaria inválida");
        if (!ownedM.includes(m.id)) {
          if (!data.buy || !m.goldPrice) throw new Error(m.premium ? "Disponível na Loja Premium." : "Você não possui essa montaria.");
          if (gold < m.goldPrice) throw new Error("Ouro insuficiente.");
          gold -= m.goldPrice; ownedM.push(m.id);
        }
        patch.mount = m.id;
      }
    }
    return save(c.id, { ...patch, gold, owned_outfits: owned, owned_mounts: ownedM } as never);
  });

export const questAction = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), quest: z.string(), op: z.enum(["accept", "complete"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const q = QUESTS.find((q) => q.id === data.quest);
    if (!q) throw new Error("Missão inválida");
    const quests = { ...c.quests };
    if (data.op === "accept") {
      if (quests[q.id]) throw new Error("Missão já iniciada.");
      quests[q.id] = { progress: 0 };
      return save(c.id, { quests });
    }
    const st = quests[q.id];
    if (!st || st.done || st.progress < q.count) throw new Error("Missão incompleta.");
    quests[q.id] = { ...st, done: true };
    const inv = [...c.inventory];
    if (q.reward.item) addItem(inv, q.reward.item, 1);
    const { levelFromExp } = await import("@/game/data");
    const exp = c.exp + q.reward.exp;
    return save(c.id, { quests, exp, level: levelFromExp(exp), gold: c.gold + q.reward.gold, inventory: inv });
  });

export const guildAction = auth
  .inputValidator((d) => z.object({
    id: z.string().uuid(), op: z.enum(["create", "join", "leave"]),
    name: z.string().trim().min(3).max(24).optional(), tag: z.string().trim().min(2).max(4).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    if (data.op === "leave") return save(c.id, { guild_id: null });
    if (c.guild_id) throw new Error("Saia da sua guild primeiro.");
    if (data.op === "create") {
      if (!data.name || !data.tag) throw new Error("Nome e tag obrigatórios");
      if (c.level < 10) throw new Error("Requer nível 10.");
      if (c.gold < 1000) throw new Error("Custa 1000 de ouro.");
      const { data: g, error } = await db().from("guilds").insert({ name: data.name, tag: data.tag.toUpperCase(), owner_character: c.id }).select("id").single();
      if (error) throw new Error("Nome de guild indisponível.");
      return save(c.id, { guild_id: g.id, gold: c.gold - 1000 });
    }
    const { data: g } = await db().from("guilds").select("id").ilike("name", data.name ?? "").maybeSingle();
    if (!g) throw new Error("Guild não encontrada.");
    return save(c.id, { guild_id: g.id });
  });

// ---------- Player-to-player market (escrowed server-side) ----------
export const tradeAction = auth
  .inputValidator((d) => z.object({
    id: z.string().uuid(), op: z.enum(["offer", "accept", "cancel", "list"]),
    to: z.string().max(18).optional(), item: z.string().optional(), qty: z.number().int().min(1).max(100).optional(),
    price: z.number().int().min(0).max(1e10).optional(), tradeId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    if (data.op === "list") {
      const { data: rows } = await db().from("trades").select("*, from:from_character(name), to:to_character(name)")
        .or(`from_character.eq.${c.id},to_character.eq.${c.id}`).eq("status", "open").order("created_at", { ascending: false });
      return { trades: rows ?? [] };
    }
    if (data.op === "offer") {
      const { data: target } = await db().from("characters").select("id").ilike("name", data.to ?? "").maybeSingle();
      if (!target || target.id === c.id) throw new Error("Jogador não encontrado.");
      const qty = data.qty ?? 1;
      const inv = [...c.inventory];
      if (!data.item || !ITEMS[data.item] || !removeItem(inv, data.item, qty)) throw new Error("Você não tem esse item.");
      await save(c.id, { inventory: inv }); // escrow
      await db().from("trades").insert({ from_character: c.id, to_character: target.id, item_id: data.item, qty, price: data.price ?? 0 });
      return { ok: true };
    }
    const { data: t } = await db().from("trades").select("*").eq("id", data.tradeId).eq("status", "open").maybeSingle();
    if (!t) throw new Error("Oferta não encontrada.");
    if (data.op === "cancel") {
      if (t.from_character !== c.id && t.to_character !== c.id) throw new Error("Sem permissão");
      const { data: ok } = await db().from("trades").update({ status: "cancelled" }).eq("id", t.id).eq("status", "open").select("id");
      if (!ok?.length) throw new Error("Oferta já encerrada.");
      const { data: seller } = await db().from("characters").select("inventory").eq("id", t.from_character).single();
      const inv = seller.inventory; addItem(inv, t.item_id, t.qty);
      await db().from("characters").update({ inventory: inv }).eq("id", t.from_character);
      return { ok: true };
    }
    if (t.to_character !== c.id) throw new Error("Essa oferta não é para você.");
    if (c.gold < Number(t.price)) throw new Error("Ouro insuficiente.");
    const inv = [...c.inventory];
    if (!addItem(inv, t.item_id, t.qty)) throw new Error("Inventário cheio.");
    const { data: ok } = await db().from("trades").update({ status: "done" }).eq("id", t.id).eq("status", "open").select("id");
    if (!ok?.length) throw new Error("Oferta já encerrada.");
    await save(c.id, { inventory: inv, gold: c.gold - Number(t.price) });
    const { data: seller } = await db().from("characters").select("bank").eq("id", t.from_character).single();
    await db().from("characters").update({ bank: Number(seller.bank) + Number(t.price) }).eq("id", t.from_character);
    return { ok: true };
  });

// ---------- Premium store (Mercado Pago) ----------
export const createCheckout = auth
  .inputValidator((d) => z.object({ id: z.string().uuid(), itemId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await getOwnedChar(context.userId, data.id);
    const it = STORE.find((s) => s.id === data.itemId);
    if (!it) throw new Error("Item inválido");
    const { data: p, error } = await db().from("purchases").insert({
      user_id: context.userId, character_id: c.id, item_id: it.id, amount: it.priceBRL,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const origin = new URL(getRequest().url).origin;
    const pref = await mpFetch("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: it.id, title: `STORM ONLINE — ${it.name}`, quantity: 1, currency_id: "BRL", unit_price: it.priceBRL }],
        external_reference: p.id,
        notification_url: `${origin}/api/public/mercadopago-webhook`,
        back_urls: { success: `${origin}/play`, failure: `${origin}/play`, pending: `${origin}/play` },
        auto_return: "approved",
      }),
    });
    await db().from("purchases").update({ mp_preference_id: pref.id }).eq("id", p.id);
    return { url: pref.init_point as string, purchaseId: p.id };
  });

export const checkPurchases = auth.inputValidator((d) => charId.parse(d)).handler(async ({ data, context }) => {
  const c = await getOwnedChar(context.userId, data.id);
  const { data: pend } = await db().from("purchases").select("id").eq("character_id", c.id).eq("status", "pending")
    .gte("created_at", new Date(Date.now() - 3 * 864e5).toISOString());
  let granted = 0;
  for (const p of pend ?? []) if (await verifyPurchaseWithMP(p.id).catch(() => false)) granted++;
  return { granted };
});
