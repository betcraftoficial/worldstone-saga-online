import { create } from "zustand";
import type { Me } from "./engine";
import type { NpcDef } from "./data";

export type ChatMsg = { id: number; ch: "global" | "local" | "system" | "party"; from?: string; text: string; color?: string };
export type Panel = "inventory" | "character" | "skills" | "store" | "npc" | "look" | "party" | "guild" | "trade" | "quests" | "arena" | "menu" | null;

let mid = 0;
type UI = {
  me: Me | null;
  setMe: (m: Me | null) => void;
  panel: Panel;
  setPanel: (p: Panel) => void;
  npc: NpcDef | null;
  openNpc: (n: NpcDef) => void;
  chat: ChatMsg[];
  push: (m: Omit<ChatMsg, "id">) => void;
  roster: { id: string; name: string }[];
  setRoster: (r: { id: string; name: string }[]) => void;
  online: number;
  setOnline: (n: number) => void;
  partyInvite: { from: string; name: string } | null;
  setPartyInvite: (p: { from: string; name: string } | null) => void;
  partyVersion: number;
  bumpParty: () => void;
  dead: boolean;
  setDead: (d: boolean) => void;
};

export const useUI = create<UI>((set) => ({
  me: null,
  setMe: (me) => set({ me }),
  panel: null,
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  npc: null,
  openNpc: (npc) => set({ npc, panel: "npc" }),
  chat: [],
  push: (m) => set((s) => ({ chat: [...s.chat.slice(-120), { ...m, id: ++mid }] })),
  roster: [],
  setRoster: (roster) => set({ roster }),
  online: 0,
  setOnline: (online) => set({ online }),
  partyInvite: null,
  setPartyInvite: (partyInvite) => set({ partyInvite }),
  partyVersion: 0,
  bumpParty: () => set((s) => ({ partyVersion: s.partyVersion + 1 })),
  dead: false,
  setDead: (dead) => set({ dead }),
}));
