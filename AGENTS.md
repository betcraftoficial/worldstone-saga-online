<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules (STORM ONLINE)
- All game content (vocations, spells, items, monsters, cities, store, quests) lives in `src/game/data.ts`; add content there, never hardcode it elsewhere — client and server both read it.
- Every persisted value (exp, level, skills, ML, gold, loot, items, purchases) is computed server-side in `src/lib/game.server.ts`; the client only reports kills/hits/mana spent, which the server rate-limits and proximity-checks — never accept final values from the client.
- Characters/purchases/trades tables have no client write policies; all writes go through server functions using the admin client after ownership checks.
- Realtime uses one broadcast channel per world region (nearest city) plus one global channel; the region's lowest character id simulates monsters and snapshots them — keeps message cost bounded.
- Mercado Pago payments are only fulfilled after re-fetching the payment from Mercado Pago with the server token (webhook or "verify" button); fulfilment flips pending→approved atomically to avoid double grants.
- The 3D game route (`/play`) is client-only (`ssr: false`); per-frame state lives in the mutable `R` object in `src/game/engine.ts`, React state only for UI.
