import { ITEMS, VOCATIONS, type VocationId } from "./data";

export type HotbarAction = { kind: "attack" } | { kind: "spell"; id: string } | { kind: "item"; id: string };

const keyFor = (characterId: string) => `storm:hotbar:${characterId}`;

export function defaultHotbar(vocation: VocationId): HotbarAction[] {
  const spells = VOCATIONS[vocation].spells.slice(0, 7).map((spell) => ({ kind: "spell", id: spell.id }) as HotbarAction);
  return [
    { kind: "attack" },
    ...spells,
    { kind: "item", id: "pocao_vida" },
    { kind: "item", id: "pocao_mana" },
  ].slice(0, 10);
}

export function loadHotbar(characterId: string, vocation: VocationId) {
  if (typeof window === "undefined") return defaultHotbar(vocation);
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(characterId)) ?? "null") as HotbarAction[] | null;
    if (Array.isArray(parsed) && parsed.length === 10) return parsed;
  } catch { /* use defaults */ }
  return defaultHotbar(vocation);
}

export function saveHotbar(characterId: string, actions: HotbarAction[]) {
  localStorage.setItem(keyFor(characterId), JSON.stringify(actions.slice(0, 10)));
  window.dispatchEvent(new CustomEvent("storm:hotbar", { detail: characterId }));
}

export function actionLabel(action: HotbarAction, vocation: VocationId) {
  if (action.kind === "attack") return "Ataque";
  if (action.kind === "item") return ITEMS[action.id]?.name ?? "Item";
  return VOCATIONS[vocation].spells.find((spell) => spell.id === action.id)?.name ?? "Magia";
}