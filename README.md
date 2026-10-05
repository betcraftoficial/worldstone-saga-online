# Eldrath Online

MMORPG 3D no navegador (PC e celular) com mundo compartilhado em tempo real.

## Rodar localmente
1. `bun install`
2. `bun run dev` → http://localhost:8080
O backend (banco, contas, tempo real) é o Lovable Cloud, já conectado ao projeto.

## Estrutura
- `src/game/data.ts` — vocações, magias, itens, monstros, cidades, loja, missões, regras de PvP
- `src/lib/game.server.ts` / `game.functions.ts` — servidor autoritativo (progressão, loot, banco, mercado, loja)
- `src/game/net.ts` — sincronização em tempo real por região
- `src/game/engine.ts` — combate, IA de monstros, estado do jogador
- `src/game/three/*` — renderização 3D · `src/game/ui/*` — HUD e painéis
- `src/routes/api/public/mercadopago-webhook.ts` — confirmação de pagamentos

## Loja (Mercado Pago)
Defina o segredo `MERCADOPAGO_ACCESS_TOKEN` (Access Token de produção ou teste do Mercado Pago).

## Controles
WASD/setas ou clique no chão para andar · clique em monstros para atacar · 1-4 magias · 5/6 poções · Tab/Espaço alvo mais próximo · I C K Q O P G T L painéis · M mapa · Enter chat · roda do mouse zoom. No celular: joystick + botões.
