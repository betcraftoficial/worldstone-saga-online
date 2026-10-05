import { R, type Me } from "../engine";
import { useUI } from "../store";
import type { CharRow } from "@/lib/game.server";

/** Apply an authoritative character row from the server to both game state and UI. */
export function commit(row: CharRow, guildTag?: string | null) {
  const prev = useUI.getState().me;
  const m: Me = { ...row, guildTag: guildTag !== undefined ? guildTag : prev?.guildTag ?? null };
  R.me = m;
  useUI.getState().setMe(m);
  return m;
}
