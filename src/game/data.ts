// Shared game definitions — used by BOTH client and server.
// Server functions recompute everything that matters (exp, loot, skills, prices)
// from these tables, so the client can never invent values.

export type VocationId = "knight" | "paladin" | "druid" | "sorcerer" | "rogue";

export type SpellDef = {
  id: string;
  name: string;
  key: string;
  mana: number;
  cooldown: number; // seconds
  kind: "target" | "area" | "self" | "heal";
  range: number;
  radius?: number;
  power: number; // multiplier
  color: string;
  minLevel: number;
  buff?: { stat: "def" | "dmg" | "speed" | "crit" | "absorb"; amount: number; duration: number };
  dot?: { dps: number; duration: number };
  slow?: number;
  desc: string;
};

export type VocationDef = {
  id: VocationId;
  name: string;
  title: string;
  desc: string;
  color: string;
  hpPerLevel: number;
  manaPerLevel: number;
  baseHp: number;
  baseMana: number;
  skillName: string;
  attackRange: number;
  attackSpeed: number; // seconds per auto attack
  mlRate: number; // magic level ease (1 = mages)
  skillRate: number;
  passive: { name: string; desc: string; dmg?: number; def?: number; crit?: number; manaRegen?: number; spell?: number };
  spells: SpellDef[];
  starterWeapon: string;
};

export const VOCATIONS: Record<VocationId, VocationDef> = {
  knight: {
    id: "knight", name: "Knight", title: "Guardião de Aço", color: "#c8553d",
    desc: "Linha de frente. Muita vida, armadura pesada e golpes em área.",
    hpPerLevel: 15, manaPerLevel: 5, baseHp: 185, baseMana: 35,
    skillName: "Espada", attackRange: 2.2, attackSpeed: 1.2, mlRate: 0.25, skillRate: 1.2,
    passive: { name: "Pele de Ferro", desc: "+15% de defesa permanente.", def: 0.15 },
    starterWeapon: "espada_curta",
    spells: [
      { id: "golpe_brutal", name: "Golpe Brutal", key: "1", mana: 20, cooldown: 2, kind: "target", range: 2.5, power: 1.8, color: "#ff7a3d", minLevel: 1, desc: "Golpe poderoso em um alvo." },
      { id: "rodopio", name: "Rodopio de Aço", key: "2", mana: 55, cooldown: 6, kind: "area", range: 0, radius: 4.5, power: 1.3, color: "#ffd27a", minLevel: 8, desc: "Gira a lâmina atingindo todos ao redor." },
      { id: "grito", name: "Grito de Guerra", key: "3", mana: 40, cooldown: 25, kind: "self", range: 0, power: 0, color: "#ffb347", minLevel: 5, buff: { stat: "def", amount: 0.35, duration: 12 }, desc: "+35% defesa por 12s." },
      { id: "cura_rapida", name: "Bandagem", key: "4", mana: 30, cooldown: 4, kind: "heal", range: 0, power: 0.8, color: "#9be36b", minLevel: 3, desc: "Cura leve instantânea." },
    ],
  },
  paladin: {
    id: "paladin", name: "Paladin", title: "Arqueiro Sagrado", color: "#e7c35a",
    desc: "Combate à distância com flechas e luz divina. Equilibrado.",
    hpPerLevel: 10, manaPerLevel: 15, baseHp: 160, baseMana: 70,
    skillName: "Distância", attackRange: 9, attackSpeed: 1.3, mlRate: 0.5, skillRate: 1.1,
    passive: { name: "Olho de Falcão", desc: "+12% de dano à distância.", dmg: 0.12 },
    starterWeapon: "arco_simples",
    spells: [
      { id: "flecha_sagrada", name: "Flecha Sagrada", key: "1", mana: 25, cooldown: 2, kind: "target", range: 10, power: 1.7, color: "#fff2a8", minLevel: 1, desc: "Flecha de luz em um alvo." },
      { id: "chuva_flechas", name: "Chuva de Flechas", key: "2", mana: 70, cooldown: 7, kind: "area", range: 10, radius: 4, power: 1.2, color: "#ffe066", minLevel: 8, desc: "Área no alvo." },
      { id: "luz_divina", name: "Luz Divina", key: "3", mana: 45, cooldown: 5, kind: "heal", range: 0, power: 1.4, color: "#fffbe0", minLevel: 3, desc: "Cura média." },
      { id: "pontaria", name: "Pontaria", key: "4", mana: 50, cooldown: 30, kind: "self", range: 0, power: 0, color: "#ffcf40", minLevel: 6, buff: { stat: "dmg", amount: 0.3, duration: 15 }, desc: "+30% dano por 15s." },
    ],
  },
  druid: {
    id: "druid", name: "Druid", title: "Voz da Floresta", color: "#5cae6a",
    desc: "Magias da natureza, gelo e as melhores curas do mundo.",
    hpPerLevel: 5, manaPerLevel: 30, baseHp: 145, baseMana: 110,
    skillName: "Bastão", attackRange: 7, attackSpeed: 1.5, mlRate: 1, skillRate: 0.6,
    passive: { name: "Fluxo Natural", desc: "Regenera mana 2x mais rápido.", manaRegen: 1 },
    starterWeapon: "cajado_raiz",
    spells: [
      { id: "espinho", name: "Espinho Venenoso", key: "1", mana: 25, cooldown: 2, kind: "target", range: 8, power: 1.1, color: "#7fd34e", minLevel: 1, dot: { dps: 0.25, duration: 6 }, desc: "Dano + veneno por 6s." },
      { id: "tempestade_gelo", name: "Tempestade de Gelo", key: "2", mana: 80, cooldown: 7, kind: "area", range: 8, radius: 4.5, power: 1.4, color: "#9be8ff", minLevel: 8, slow: 0.5, desc: "Área que congela e desacelera." },
      { id: "cura_natural", name: "Cura Natural", key: "3", mana: 50, cooldown: 3, kind: "heal", range: 0, power: 2.2, color: "#b6ff8a", minLevel: 1, desc: "Grande cura." },
      { id: "raizes", name: "Raízes", key: "4", mana: 40, cooldown: 12, kind: "target", range: 8, power: 0.5, color: "#a07a3c", minLevel: 5, slow: 0.85, desc: "Prende o alvo." },
    ],
  },
  sorcerer: {
    id: "sorcerer", name: "Sorcerer", title: "Arcano Rubro", color: "#e0573f",
    desc: "Dano mágico devastador em área. Frágil, mas letal.",
    hpPerLevel: 5, manaPerLevel: 30, baseHp: 140, baseMana: 115,
    skillName: "Bastão", attackRange: 7, attackSpeed: 1.5, mlRate: 1, skillRate: 0.6,
    passive: { name: "Mente Arcana", desc: "+20% dano de magias.", spell: 0.2 },
    starterWeapon: "varinha_brasa",
    spells: [
      { id: "bola_fogo", name: "Bola de Fogo", key: "1", mana: 25, cooldown: 2, kind: "target", range: 9, power: 1.6, color: "#ff6a1f", minLevel: 1, desc: "Projétil flamejante." },
      { id: "inferno", name: "Inferno", key: "2", mana: 100, cooldown: 8, kind: "area", range: 9, radius: 5, power: 1.8, color: "#ff3d00", minLevel: 8, desc: "Explosão de fogo em área." },
      { id: "raio_arcano", name: "Raio Arcano", key: "3", mana: 70, cooldown: 10, kind: "target", range: 10, power: 3.2, color: "#7ad7ff", minLevel: 6, desc: "Dano altíssimo em um alvo." },
      { id: "escudo_mana", name: "Escudo de Mana", key: "4", mana: 50, cooldown: 30, kind: "self", range: 0, power: 0, color: "#5fb6ff", minLevel: 4, buff: { stat: "absorb", amount: 0.5, duration: 20 }, desc: "Mana absorve 50% do dano por 20s." },
    ],
  },
  rogue: {
    id: "rogue", name: "Rogue", title: "Lâmina Oculta", color: "#7d8a9a",
    desc: "Rápido e letal. Críticos, venenos e furtividade.",
    hpPerLevel: 10, manaPerLevel: 10, baseHp: 160, baseMana: 60,
    skillName: "Adagas", attackRange: 2, attackSpeed: 0.8, mlRate: 0.35, skillRate: 1.3,
    passive: { name: "Instinto Assassino", desc: "15% de chance de crítico (2x).", crit: 0.15 },
    starterWeapon: "adaga_gasta",
    spells: [
      { id: "apunhalar", name: "Apunhalar", key: "1", mana: 20, cooldown: 2, kind: "target", range: 2.5, power: 2.0, color: "#d9e2ec", minLevel: 1, desc: "Golpe preciso." },
      { id: "leque", name: "Leque de Lâminas", key: "2", mana: 50, cooldown: 6, kind: "area", range: 0, radius: 4, power: 1.2, color: "#c0c8d0", minLevel: 8, desc: "Lâminas ao redor." },
      { id: "sombra", name: "Passo Sombrio", key: "3", mana: 35, cooldown: 18, kind: "self", range: 0, power: 0, color: "#4b5563", minLevel: 4, buff: { stat: "speed", amount: 0.6, duration: 6 }, desc: "+60% velocidade por 6s." },
      { id: "veneno_laminas", name: "Lâminas Envenenadas", key: "4", mana: 40, cooldown: 25, kind: "self", range: 0, power: 0, color: "#8bdc4b", minLevel: 6, buff: { stat: "crit", amount: 0.25, duration: 15 }, desc: "+25% crítico por 15s." },
    ],
  },
};

export const VOCATION_LIST = Object.values(VOCATIONS);

// ---------- Progression formulas ----------
export const MAX_LEVEL = 500;
export function expForLevel(level: number) {
  if (level <= 1) return 0;
  return Math.round(55 * Math.pow(level - 1, 2.55));
}
export function levelFromExp(exp: number) {
  let l = 1;
  while (l < MAX_LEVEL && exp >= expForLevel(l + 1)) l++;
  return l;
}
export function maxHp(v: VocationId, level: number) {
  const d = VOCATIONS[v];
  return d.baseHp + (level - 1) * d.hpPerLevel;
}
export function maxMana(v: VocationId, level: number) {
  const d = VOCATIONS[v];
  return d.baseMana + (level - 1) * d.manaPerLevel;
}
/** Hits needed to advance one skill level */
export function skillReq(skill: number, v: VocationId) {
  return (25 * Math.pow(1.09, skill - 10)) / VOCATIONS[v].skillRate;
}
/** Mana needed to advance one magic level — mages progress far faster */
export function mlReq(ml: number, v: VocationId) {
  return (180 * Math.pow(1.12, ml)) / VOCATIONS[v].mlRate;
}
export function moveSpeed(level: number) {
  return 6 + Math.min(level, 200) * 0.012;
}

// ---------- PvP & death rules (configurable) ----------
export const PVP_RULES = {
  protectionLevel: 8, // players below this cannot attack or be attacked
  expLossPct: 0.07, // % of total exp lost on death
  itemLossChance: 0.1, // chance per inventory stack to drop
  redSkullItemLoss: 1.0, // red skull loses everything
  whiteSkullMinutes: 15,
  redSkullFrags: 3, // unjustified kills to get red skull
  redSkullDays: 3,
};

// ---------- Items ----------
export type Slot = "weapon" | "shield" | "helmet" | "armor" | "legs" | "boots";
export type ItemDef = {
  id: string;
  name: string;
  slot?: Slot;
  atk?: number;
  def?: number;
  vocations?: VocationId[];
  price: number; // NPC buy price (0 = not sold)
  sell: number;
  color: string;
  use?: { hp?: number; mana?: number };
  icon: string;
  minLevel?: number;
};

export const ITEMS: Record<string, ItemDef> = {
  // weapons
  espada_curta: { id: "espada_curta", name: "Espada Curta", slot: "weapon", atk: 12, vocations: ["knight"], price: 60, sell: 15, color: "#cfd6dd", icon: "🗡️" },
  espada_longa: { id: "espada_longa", name: "Espada de Aldoria", slot: "weapon", atk: 22, vocations: ["knight"], price: 900, sell: 220, color: "#e2e8f0", icon: "⚔️", minLevel: 15 },
  machado_runico: { id: "machado_runico", name: "Machado Rúnico", slot: "weapon", atk: 36, vocations: ["knight"], price: 0, sell: 2500, color: "#f59e0b", icon: "🪓", minLevel: 30 },
  arco_simples: { id: "arco_simples", name: "Arco Simples", slot: "weapon", atk: 11, vocations: ["paladin"], price: 70, sell: 15, color: "#a16207", icon: "🏹" },
  arco_elfico: { id: "arco_elfico", name: "Arco Élfico", slot: "weapon", atk: 21, vocations: ["paladin"], price: 950, sell: 230, color: "#65a30d", icon: "🏹", minLevel: 15 },
  besta_solar: { id: "besta_solar", name: "Besta Solar", slot: "weapon", atk: 34, vocations: ["paladin"], price: 0, sell: 2600, color: "#fbbf24", icon: "🎯", minLevel: 30 },
  cajado_raiz: { id: "cajado_raiz", name: "Cajado de Raiz", slot: "weapon", atk: 9, vocations: ["druid"], price: 60, sell: 15, color: "#6b8e23", icon: "🪄" },
  cajado_gelido: { id: "cajado_gelido", name: "Cajado Gélido", slot: "weapon", atk: 18, vocations: ["druid"], price: 900, sell: 220, color: "#7dd3fc", icon: "🪄", minLevel: 15 },
  varinha_brasa: { id: "varinha_brasa", name: "Varinha de Brasa", slot: "weapon", atk: 9, vocations: ["sorcerer"], price: 60, sell: 15, color: "#f97316", icon: "🪄" },
  varinha_inferno: { id: "varinha_inferno", name: "Varinha do Inferno", slot: "weapon", atk: 18, vocations: ["sorcerer"], price: 900, sell: 220, color: "#ef4444", icon: "🔥", minLevel: 15 },
  adaga_gasta: { id: "adaga_gasta", name: "Adaga Gasta", slot: "weapon", atk: 10, vocations: ["rogue"], price: 60, sell: 15, color: "#94a3b8", icon: "🔪" },
  adagas_gemeas: { id: "adagas_gemeas", name: "Adagas Gêmeas", slot: "weapon", atk: 20, vocations: ["rogue"], price: 950, sell: 230, color: "#cbd5e1", icon: "🔪", minLevel: 15 },
  // armor
  escudo_madeira: { id: "escudo_madeira", name: "Escudo de Madeira", slot: "shield", def: 6, vocations: ["knight", "paladin"], price: 50, sell: 10, color: "#92400e", icon: "🛡️" },
  escudo_aco: { id: "escudo_aco", name: "Escudo de Aço", slot: "shield", def: 14, vocations: ["knight", "paladin"], price: 700, sell: 170, color: "#9ca3af", icon: "🛡️", minLevel: 12 },
  capuz_couro: { id: "capuz_couro", name: "Capuz de Couro", slot: "helmet", def: 2, price: 30, sell: 6, color: "#a16207", icon: "🪖" },
  elmo_ferro: { id: "elmo_ferro", name: "Elmo de Ferro", slot: "helmet", def: 5, price: 400, sell: 90, color: "#9ca3af", icon: "⛑️", minLevel: 10 },
  peitoral_couro: { id: "peitoral_couro", name: "Peitoral de Couro", slot: "armor", def: 4, price: 50, sell: 10, color: "#a16207", icon: "🥋" },
  cota_malha: { id: "cota_malha", name: "Cota de Malha", slot: "armor", def: 9, price: 600, sell: 140, color: "#9ca3af", icon: "🦺", minLevel: 10 },
  manto_arcano: { id: "manto_arcano", name: "Manto Arcano", slot: "armor", def: 7, vocations: ["druid", "sorcerer"], price: 700, sell: 160, color: "#2563eb", icon: "🧥", minLevel: 12 },
  calca_couro: { id: "calca_couro", name: "Calça de Couro", slot: "legs", def: 2, price: 35, sell: 7, color: "#a16207", icon: "👖" },
  calca_aco: { id: "calca_aco", name: "Grevas de Aço", slot: "legs", def: 6, price: 500, sell: 110, color: "#9ca3af", icon: "👖", minLevel: 12 },
  botas_couro: { id: "botas_couro", name: "Botas de Couro", slot: "boots", def: 1, price: 25, sell: 5, color: "#78350f", icon: "🥾" },
  botas_vento: { id: "botas_vento", name: "Botas do Vento", slot: "boots", def: 3, price: 0, sell: 1500, color: "#67e8f9", icon: "👢", minLevel: 20 },
  // consumables
  pocao_vida: { id: "pocao_vida", name: "Poção de Vida", use: { hp: 120 }, price: 45, sell: 0, color: "#ef4444", icon: "🧪" },
  pocao_mana: { id: "pocao_mana", name: "Poção de Mana", use: { mana: 100 }, price: 50, sell: 0, color: "#3b82f6", icon: "🧪" },
  grande_pocao_vida: { id: "grande_pocao_vida", name: "Grande Poção de Vida", use: { hp: 400 }, price: 190, sell: 0, color: "#dc2626", icon: "⚗️", minLevel: 30 },
  grande_pocao_mana: { id: "grande_pocao_mana", name: "Grande Poção de Mana", use: { mana: 300 }, price: 140, sell: 0, color: "#1d4ed8", icon: "⚗️", minLevel: 30 },
  // loot
  pele_lobo: { id: "pele_lobo", name: "Pele de Lobo", price: 0, sell: 12, color: "#6b7280", icon: "🐺" },
  orelha_goblin: { id: "orelha_goblin", name: "Orelha de Goblin", price: 0, sell: 18, color: "#65a30d", icon: "👂" },
  osso: { id: "osso", name: "Osso Antigo", price: 0, sell: 10, color: "#e5e7eb", icon: "🦴" },
  ferrao: { id: "ferrao", name: "Ferrão de Escorpião", price: 0, sell: 40, color: "#b45309", icon: "🦂" },
  dente_orc: { id: "dente_orc", name: "Dente de Orc", price: 0, sell: 35, color: "#f5f5f4", icon: "🦷" },
  faixa_mumia: { id: "faixa_mumia", name: "Faixa de Múmia", price: 0, sell: 70, color: "#d6c7a1", icon: "🎗️" },
  cristal_gelo: { id: "cristal_gelo", name: "Cristal de Gelo", price: 0, sell: 120, color: "#a5f3fc", icon: "💎" },
  escama_dragao: { id: "escama_dragao", name: "Escama de Dragão", price: 0, sell: 300, color: "#dc2626", icon: "🐉" },
  coroa_goblin: { id: "coroa_goblin", name: "Coroa do Rei Goblin", price: 0, sell: 1200, color: "#facc15", icon: "👑" },
  grimorio_lich: { id: "grimorio_lich", name: "Grimório do Lich", price: 0, sell: 3500, color: "#4c1d95", icon: "📕" },
  coracao_dragao: { id: "coracao_dragao", name: "Coração de Dragão", price: 0, sell: 8000, color: "#b91c1c", icon: "❤️‍🔥" },
};

// ---------- Monsters ----------
export type MonsterShape = "quad" | "biped" | "blob" | "insect" | "dragon";
export type MonsterDef = {
  id: string;
  name: string;
  hp: number;
  exp: number;
  dmg: [number, number];
  speed: number;
  range: number;
  color: string;
  color2: string;
  scale: number;
  shape: MonsterShape;
  boss?: boolean;
  gold: [number, number];
  loot: { item: string; chance: number }[];
  respawn: number;
};

export const MONSTERS: Record<string, MonsterDef> = {
  rato: { id: "rato", name: "Rato do Esgoto", hp: 25, exp: 6, dmg: [1, 6], speed: 3, range: 1.3, color: "#8b7d6b", color2: "#d4a5a5", scale: 0.45, shape: "quad", gold: [0, 4], loot: [{ item: "osso", chance: 0.2 }], respawn: 15 },
  lobo: { id: "lobo", name: "Lobo Cinzento", hp: 45, exp: 18, dmg: [3, 12], speed: 4.2, range: 1.5, color: "#6b7280", color2: "#e5e7eb", scale: 0.7, shape: "quad", gold: [0, 8], loot: [{ item: "pele_lobo", chance: 0.5 }], respawn: 20 },
  goblin: { id: "goblin", name: "Goblin Saqueador", hp: 70, exp: 30, dmg: [5, 16], speed: 3.4, range: 1.5, color: "#65a30d", color2: "#78350f", scale: 0.7, shape: "biped", gold: [3, 18], loot: [{ item: "orelha_goblin", chance: 0.4 }, { item: "pocao_vida", chance: 0.08 }, { item: "capuz_couro", chance: 0.05 }], respawn: 25 },
  esqueleto: { id: "esqueleto", name: "Esqueleto Errante", hp: 110, exp: 50, dmg: [8, 22], speed: 3, range: 1.6, color: "#e7e5e4", color2: "#57534e", scale: 0.95, shape: "biped", gold: [5, 25], loot: [{ item: "osso", chance: 0.7 }, { item: "elmo_ferro", chance: 0.03 }], respawn: 30 },
  escorpiao: { id: "escorpiao", name: "Escorpião das Dunas", hp: 150, exp: 75, dmg: [10, 30], speed: 3.6, range: 1.6, color: "#b45309", color2: "#451a03", scale: 0.9, shape: "insect", gold: [5, 30], loot: [{ item: "ferrao", chance: 0.45 }, { item: "pocao_mana", chance: 0.1 }], respawn: 30 },
  orc: { id: "orc", name: "Orc Brutamontes", hp: 220, exp: 110, dmg: [14, 40], speed: 3.3, range: 1.7, color: "#4d7c0f", color2: "#3f3f46", scale: 1.15, shape: "biped", gold: [10, 45], loot: [{ item: "dente_orc", chance: 0.5 }, { item: "cota_malha", chance: 0.03 }, { item: "escudo_aco", chance: 0.02 }], respawn: 35 },
  mumia: { id: "mumia", name: "Múmia Faraônica", hp: 320, exp: 170, dmg: [18, 50], speed: 2.6, range: 1.7, color: "#d6c7a1", color2: "#78716c", scale: 1.05, shape: "biped", gold: [15, 60], loot: [{ item: "faixa_mumia", chance: 0.5 }, { item: "manto_arcano", chance: 0.02 }], respawn: 40 },
  golem_gelo: { id: "golem_gelo", name: "Golem de Gelo", hp: 520, exp: 280, dmg: [25, 70], speed: 2.4, range: 2, color: "#a5f3fc", color2: "#0e7490", scale: 1.5, shape: "biped", gold: [25, 90], loot: [{ item: "cristal_gelo", chance: 0.35 }, { item: "calca_aco", chance: 0.03 }, { item: "grande_pocao_mana", chance: 0.1 }], respawn: 45 },
  aranha: { id: "aranha", name: "Aranha Sombria", hp: 260, exp: 140, dmg: [15, 45], speed: 4, range: 1.6, color: "#27272a", color2: "#dc2626", scale: 0.9, shape: "insect", gold: [10, 50], loot: [{ item: "pocao_vida", chance: 0.15 }], respawn: 35 },
  draconete: { id: "draconete", name: "Draconete", hp: 900, exp: 600, dmg: [40, 110], speed: 3.2, range: 2.5, color: "#dc2626", color2: "#facc15", scale: 1.4, shape: "dragon", gold: [60, 200], loot: [{ item: "escama_dragao", chance: 0.4 }, { item: "grande_pocao_vida", chance: 0.2 }, { item: "botas_vento", chance: 0.01 }], respawn: 60 },
  // bosses
  rei_goblin: { id: "rei_goblin", name: "Grakk, o Rei Goblin", hp: 1500, exp: 1200, dmg: [20, 80], speed: 3.2, range: 2, color: "#84cc16", color2: "#facc15", scale: 1.6, shape: "biped", boss: true, gold: [300, 800], loot: [{ item: "coroa_goblin", chance: 0.6 }, { item: "espada_longa", chance: 0.3 }, { item: "arco_elfico", chance: 0.3 }], respawn: 600 },
  lich: { id: "lich", name: "Morthal, o Lich", hp: 4000, exp: 3500, dmg: [40, 150], speed: 2.8, range: 6, color: "#1e1b4b", color2: "#22d3ee", scale: 1.8, shape: "biped", boss: true, gold: [800, 2000], loot: [{ item: "grimorio_lich", chance: 0.5 }, { item: "varinha_inferno", chance: 0.3 }, { item: "cajado_gelido", chance: 0.3 }], respawn: 1200 },
  dragao_anciao: { id: "dragao_anciao", name: "Vermithrax, Dragão Ancião", hp: 12000, exp: 12000, dmg: [80, 300], speed: 3, range: 7, color: "#7f1d1d", color2: "#fbbf24", scale: 3, shape: "dragon", boss: true, gold: [3000, 8000], loot: [{ item: "coracao_dragao", chance: 0.6 }, { item: "machado_runico", chance: 0.35 }, { item: "besta_solar", chance: 0.35 }], respawn: 1800 },
};

// ---------- World ----------
export type CityDef = { id: string; name: string; x: number; z: number; radius: number; biome: Biome; npcs: NpcDef[] };
export type Biome = "plains" | "coast" | "desert" | "forest" | "snow";
export type NpcDef = { id: string; name: string; role: "shop" | "bank" | "quest" | "outfit" | "temple"; dx: number; dz: number; sells?: string[]; color: string };

const basicShop = ["pocao_vida", "pocao_mana", "capuz_couro", "peitoral_couro", "calca_couro", "botas_couro", "escudo_madeira"];

export const CITIES: CityDef[] = [
  { id: "aldoria", name: "Aldoria", x: 0, z: 0, radius: 32, biome: "plains", npcs: [
    { id: "aldoria_merc", name: "Bruna, a Mercadora", role: "shop", dx: 10, dz: 6, sells: [...basicShop, "espada_curta", "arco_simples", "cajado_raiz", "varinha_brasa", "adaga_gasta"], color: "#f59e0b" },
    { id: "aldoria_bank", name: "Tomás, o Banqueiro", role: "bank", dx: -10, dz: 6, color: "#eab308" },
    { id: "aldoria_quest", name: "Capitã Elara", role: "quest", dx: 0, dz: -12, color: "#38bdf8" },
    { id: "aldoria_outfit", name: "Mestre Alfaiate Rui", role: "outfit", dx: 12, dz: -8, color: "#f472b6" },
  ] },
  { id: "brisapor", name: "Brisapor", x: 175, z: -115, radius: 28, biome: "coast", npcs: [
    { id: "bris_merc", name: "Marujo Dante", role: "shop", dx: 8, dz: 6, sells: [...basicShop, "espada_longa", "arco_elfico", "escudo_aco", "elmo_ferro"], color: "#0ea5e9" },
    { id: "bris_bank", name: "Cofre do Porto", role: "bank", dx: -8, dz: 6, color: "#eab308" },
    { id: "bris_quest", name: "Velho Pescador Iago", role: "quest", dx: 0, dz: -10, color: "#38bdf8" },
  ] },
  { id: "dunarubra", name: "Duna Rubra", x: -180, z: -145, radius: 28, biome: "desert", npcs: [
    { id: "duna_merc", name: "Zahir, o Errante", role: "shop", dx: 8, dz: 6, sells: [...basicShop, "grande_pocao_vida", "grande_pocao_mana", "cota_malha", "calca_aco"], color: "#f97316" },
    { id: "duna_bank", name: "Tesouro do Oásis", role: "bank", dx: -8, dz: 6, color: "#eab308" },
    { id: "duna_quest", name: "Sacerdotisa Nadira", role: "quest", dx: 0, dz: -10, color: "#38bdf8" },
  ] },
  { id: "valesombrio", name: "Vale Sombrio", x: -165, z: 150, radius: 26, biome: "forest", npcs: [
    { id: "vale_merc", name: "Ervanária Lia", role: "shop", dx: 8, dz: 6, sells: [...basicShop, "cajado_gelido", "varinha_inferno", "manto_arcano", "adagas_gemeas"], color: "#22c55e" },
    { id: "vale_bank", name: "Cofre dos Druidas", role: "bank", dx: -8, dz: 6, color: "#eab308" },
    { id: "vale_quest", name: "Ancião Thorn", role: "quest", dx: 0, dz: -10, color: "#38bdf8" },
  ] },
  { id: "ferrogelo", name: "Ferrogelo", x: 170, z: 165, radius: 26, biome: "snow", npcs: [
    { id: "ferro_merc", name: "Ferreiro Bjorn", role: "shop", dx: 8, dz: 6, sells: [...basicShop, "grande_pocao_vida", "grande_pocao_mana", "escudo_aco", "elmo_ferro", "calca_aco", "cota_malha"], color: "#94a3b8" },
    { id: "ferro_bank", name: "Cofre Gélido", role: "bank", dx: -8, dz: 6, color: "#eab308" },
    { id: "ferro_outfit", name: "Peleteira Sigrid", role: "outfit", dx: 10, dz: -8, color: "#f472b6" },
  ] },
];

export const WORLD_SIZE = 280; // half-extent

export type ZoneDef = { id: string; name: string; x: number; z: number; radius: number; kind: "pvp" | "dungeon" | "danger" };
export const ZONES: ZoneDef[] = [
  { id: "arena", name: "Arena Sangrenta (PvP)", x: 0, z: -205, radius: 30, kind: "pvp" },
  { id: "caverna_ecos", name: "Caverna dos Ecos", x: 75, z: 85, radius: 26, kind: "dungeon" },
  { id: "catacumbas", name: "Catacumbas de Morthal", x: -225, z: 225, radius: 28, kind: "dungeon" },
  { id: "covil", name: "Covil de Vermithrax", x: 225, z: 235, radius: 32, kind: "danger" },
  { id: "acampamento", name: "Acampamento Goblin", x: -70, z: -60, radius: 22, kind: "danger" },
];

export const SPAWNS: { type: string; x: number; z: number; count: number; radius: number }[] = [
  { type: "rato", x: 35, z: 40, count: 6, radius: 12 },
  { type: "rato", x: -40, z: 35, count: 5, radius: 10 },
  { type: "lobo", x: 60, z: -30, count: 6, radius: 15 },
  { type: "lobo", x: -55, z: 65, count: 5, radius: 14 },
  { type: "goblin", x: -70, z: -60, count: 8, radius: 16 },
  { type: "rei_goblin", x: -75, z: -68, count: 1, radius: 2 },
  { type: "esqueleto", x: 75, z: 85, count: 7, radius: 16 },
  { type: "aranha", x: 85, z: 95, count: 4, radius: 10 },
  { type: "orc", x: 110, z: -60, count: 6, radius: 16 },
  { type: "orc", x: 130, z: 40, count: 5, radius: 14 },
  { type: "escorpiao", x: -150, z: -95, count: 7, radius: 18 },
  { type: "mumia", x: -215, z: -185, count: 6, radius: 18 },
  { type: "aranha", x: -120, z: 120, count: 6, radius: 16 },
  { type: "esqueleto", x: -225, z: 225, count: 8, radius: 18 },
  { type: "lich", x: -232, z: 232, count: 1, radius: 2 },
  { type: "golem_gelo", x: 130, z: 140, count: 5, radius: 16 },
  { type: "draconete", x: 215, z: 220, count: 5, radius: 18 },
  { type: "dragao_anciao", x: 235, z: 245, count: 1, radius: 2 },
  { type: "lobo", x: 140, z: -150, count: 5, radius: 14 },
  { type: "goblin", x: 0, z: -205, count: 4, radius: 14 },
];

export type MonsterSpawn = { idx: number; type: string; x: number; z: number; region: string };
function seeded(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export const MONSTER_SPAWNS: MonsterSpawn[] = (() => {
  const out: MonsterSpawn[] = [];
  let idx = 0;
  for (const s of SPAWNS) {
    for (let k = 0; k < s.count; k++) {
      const a = seeded(idx * 3 + 1) * Math.PI * 2;
      const r = Math.sqrt(seeded(idx * 3 + 2)) * s.radius;
      const x = s.x + Math.cos(a) * r;
      const z = s.z + Math.sin(a) * r;
      out.push({ idx, type: s.type, x, z, region: regionOf(x, z) });
      idx++;
    }
  }
  return out;
})();

/** The network region (shard) a position belongs to — nearest city */
export function regionOf(x: number, z: number) {
  let best = CITIES[0];
  let bd = Infinity;
  for (const c of CITIES) {
    const d = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best.id;
}
export function cityAt(x: number, z: number) {
  return CITIES.find((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < c.radius * c.radius) ?? null;
}
export function zoneAt(x: number, z: number) {
  return ZONES.find((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < c.radius * c.radius) ?? null;
}
export function biomeAt(x: number, z: number): Biome {
  const c = CITIES.find((c) => c.id === regionOf(x, z))!;
  return c.biome;
}

// ---------- Outfits, mounts & premium store ----------
export type OutfitDef = {
  id: string; name: string; body: string; trim: string; head: string; cape?: string;
  effect?: "gold" | "fire" | "frost" | "shadow" | "nature" | "stars";
  goldPrice?: number; premium?: boolean;
};
export const OUTFITS: Record<string, OutfitDef> = {
  aventureiro: { id: "aventureiro", name: "Aventureiro", body: "#7c5a3a", trim: "#d6b98c", head: "#5b4636" },
  cacador: { id: "cacador", name: "Caçador", body: "#3f6212", trim: "#a3e635", head: "#365314", cape: "#4d7c0f", goldPrice: 800 },
  marinheiro: { id: "marinheiro", name: "Marinheiro", body: "#1e3a8a", trim: "#f8fafc", head: "#1e40af", goldPrice: 1200 },
  nomade: { id: "nomade", name: "Nômade", body: "#c2410c", trim: "#fde68a", head: "#9a3412", cape: "#ea580c", goldPrice: 1500 },
  barbaro: { id: "barbaro", name: "Bárbaro", body: "#57534e", trim: "#e7e5e4", head: "#44403c", cape: "#78716c", goldPrice: 2500 },
  nobre: { id: "nobre", name: "Nobre", body: "#7f1d1d", trim: "#facc15", head: "#991b1b", cape: "#b91c1c", goldPrice: 6000 },
  // premium
  celestial: { id: "celestial", name: "Cavaleiro Celestial", body: "#f8fafc", trim: "#fbbf24", head: "#fde68a", cape: "#fbbf24", effect: "gold", premium: true },
  fenix: { id: "fenix", name: "Arauto da Fênix", body: "#b91c1c", trim: "#fb923c", head: "#7f1d1d", cape: "#f97316", effect: "fire", premium: true },
  gelo_eterno: { id: "gelo_eterno", name: "Guardião do Gelo Eterno", body: "#e0f2fe", trim: "#38bdf8", head: "#bae6fd", cape: "#0ea5e9", effect: "frost", premium: true },
  sombra: { id: "sombra", name: "Lorde das Sombras", body: "#18181b", trim: "#22d3ee", head: "#27272a", cape: "#09090b", effect: "shadow", premium: true },
  floresta: { id: "floresta", name: "Espírito da Floresta", body: "#14532d", trim: "#86efac", head: "#166534", cape: "#15803d", effect: "nature", premium: true },
  astral: { id: "astral", name: "Viajante Astral", body: "#0c1a3a", trim: "#fde047", head: "#1e3a8a", cape: "#1e40af", effect: "stars", premium: true },
};

export type MountDef = { id: string; name: string; kind: "wolf" | "deer" | "griffin" | "drake" | "horse" | "bear"; color: string; color2: string; speed: number; effect?: OutfitDef["effect"]; goldPrice?: number; premium?: boolean };
export const MOUNTS: Record<string, MountDef> = {
  pônei: { id: "pônei", name: "Pônei de Aldoria", kind: "horse", color: "#a16207", color2: "#fef3c7", speed: 0.15, goldPrice: 5000 },
  urso: { id: "urso", name: "Urso das Neves", kind: "bear", color: "#f1f5f9", color2: "#94a3b8", speed: 0.15, goldPrice: 12000 },
  lobo_sombrio: { id: "lobo_sombrio", name: "Lobo Sombrio", kind: "wolf", color: "#1f2937", color2: "#22d3ee", speed: 0.3, effect: "shadow", premium: true },
  cervo_lunar: { id: "cervo_lunar", name: "Cervo Lunar", kind: "deer", color: "#e0f2fe", color2: "#7dd3fc", speed: 0.3, effect: "frost", premium: true },
  grifo: { id: "grifo", name: "Grifo Dourado", kind: "griffin", color: "#f59e0b", color2: "#fef3c7", speed: 0.35, effect: "gold", premium: true },
  draco: { id: "draco", name: "Draco Flamejante", kind: "drake", color: "#b91c1c", color2: "#fb923c", speed: 0.35, effect: "fire", premium: true },
};

export type StoreItem = {
  id: string; name: string; desc: string; priceBRL: number;
  grant: { outfit?: string; mount?: string; xpBoostHours?: number; items?: { id: string; qty: number }[]; gold?: number };
  badge?: string;
};
export const STORE: StoreItem[] = [
  { id: "outfit_celestial", name: "Cavaleiro Celestial", desc: "Outfit dourada com aura de luz.", priceBRL: 19.9, grant: { outfit: "celestial" }, badge: "Lendário" },
  { id: "outfit_fenix", name: "Arauto da Fênix", desc: "Outfit em chamas com brasas.", priceBRL: 19.9, grant: { outfit: "fenix" } },
  { id: "outfit_gelo", name: "Guardião do Gelo Eterno", desc: "Cristais de gelo flutuantes.", priceBRL: 17.9, grant: { outfit: "gelo_eterno" } },
  { id: "outfit_sombra", name: "Lorde das Sombras", desc: "Névoa sombria ao redor.", priceBRL: 17.9, grant: { outfit: "sombra" } },
  { id: "outfit_floresta", name: "Espírito da Floresta", desc: "Folhas e vagalumes.", priceBRL: 14.9, grant: { outfit: "floresta" } },
  { id: "outfit_astral", name: "Viajante Astral", desc: "Estrelas orbitando você.", priceBRL: 24.9, grant: { outfit: "astral" }, badge: "Novo" },
  { id: "mount_lobo", name: "Lobo Sombrio", desc: "Montaria +30% velocidade.", priceBRL: 24.9, grant: { mount: "lobo_sombrio" } },
  { id: "mount_cervo", name: "Cervo Lunar", desc: "Montaria +30% velocidade.", priceBRL: 24.9, grant: { mount: "cervo_lunar" } },
  { id: "mount_grifo", name: "Grifo Dourado", desc: "Montaria +35% velocidade.", priceBRL: 34.9, grant: { mount: "grifo" }, badge: "Lendário" },
  { id: "mount_draco", name: "Draco Flamejante", desc: "Montaria +35% velocidade.", priceBRL: 34.9, grant: { mount: "draco" } },
  { id: "xp_3h", name: "Poção de XP (3h)", desc: "+50% de experiência por 3 horas.", priceBRL: 4.9, grant: { xpBoostHours: 3 } },
  { id: "xp_24h", name: "Poção de XP (24h)", desc: "+50% de experiência por 24 horas.", priceBRL: 14.9, grant: { xpBoostHours: 24 }, badge: "Popular" },
  { id: "kit_potions", name: "Kit de Poções", desc: "50 poções de vida + 50 de mana.", priceBRL: 6.9, grant: { items: [{ id: "pocao_vida", qty: 50 }, { id: "pocao_mana", qty: 50 }] } },
  { id: "bolsa_ouro", name: "Bolsa de Ouro", desc: "25.000 moedas de ouro.", priceBRL: 9.9, grant: { gold: 25000 } },
];

export const QUESTS = [
  { id: "ratos", name: "Praga de Ratos", giver: "aldoria_quest", desc: "Elimine 10 Ratos do Esgoto.", monster: "rato", count: 10, reward: { exp: 150, gold: 100 } },
  { id: "lobos", name: "Uivos na Noite", giver: "aldoria_quest", desc: "Cace 10 Lobos Cinzentos.", monster: "lobo", count: 10, reward: { exp: 400, gold: 250, item: "botas_couro" } },
  { id: "goblins", name: "Acampamento Goblin", giver: "aldoria_quest", desc: "Derrote 15 Goblins.", monster: "goblin", count: 15, reward: { exp: 1200, gold: 600 } },
  { id: "rei", name: "A Coroa Roubada", giver: "aldoria_quest", desc: "Derrote Grakk, o Rei Goblin.", monster: "rei_goblin", count: 1, reward: { exp: 3000, gold: 2000 } },
  { id: "orcs", name: "Fúria Orc", giver: "bris_quest", desc: "Derrote 20 Orcs.", monster: "orc", count: 20, reward: { exp: 5000, gold: 1500 } },
  { id: "escorpioes", name: "Ferrões do Deserto", giver: "duna_quest", desc: "Derrote 20 Escorpiões.", monster: "escorpiao", count: 20, reward: { exp: 4000, gold: 1200 } },
  { id: "mumias", name: "Tumba Inquieta", giver: "duna_quest", desc: "Derrote 15 Múmias.", monster: "mumia", count: 15, reward: { exp: 7000, gold: 2500 } },
  { id: "aranhas", name: "Teias do Vale", giver: "vale_quest", desc: "Derrote 15 Aranhas Sombrias.", monster: "aranha", count: 15, reward: { exp: 5000, gold: 1500 } },
  { id: "lich", name: "O Fim de Morthal", giver: "vale_quest", desc: "Derrote Morthal, o Lich.", monster: "lich", count: 1, reward: { exp: 15000, gold: 8000 } },
];

export function weaponAtk(equipment: Record<string, string | undefined>) {
  const w = equipment.weapon ? ITEMS[equipment.weapon] : undefined;
  return w?.atk ?? 5;
}
export function totalDef(equipment: Record<string, string | undefined>) {
  let d = 0;
  for (const s of ["shield", "helmet", "armor", "legs", "boots"] as const) {
    const it = equipment[s] ? ITEMS[equipment[s]!] : undefined;
    d += it?.def ?? 0;
  }
  return d;
}
