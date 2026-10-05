# Plano — grande evolução para STORM ONLINE

## Objetivo
Transformar a versão atual em uma fase jogável e integrada de **STORM ONLINE**, priorizando progressão real: tutorial → missões → exploração → combate → loot → equipamento → magias → nível → chefes → PvP/Arena.

## Entregas

### 1. Identidade e interface
- Substituir “Eldrath Online” por “STORM ONLINE” em login, seleção de personagens, jogo, ranking, textos, pagamentos, metadados e documentação.
- Reorganizar o HUD para destacar HP, Mana, XP, nível, estado de combate e caveira PK sem cobrir o mundo.
- Adicionar acesso visível à Arena e manter inventário, equipamentos, missões, minimapa e Loja Premium utilizáveis em PC e celular.

### 2. Mundo medieval sombrio e explorável
- Recolorir iluminação, céu, neblina, água e terreno para uma fantasia sombria legível, com luz quente nas áreas habitadas.
- Evoluir as cinco cidades com muralhas, portões, torres, praças, casas e iluminação própria por região.
- Adicionar marcos físicos: pontes, entradas de cavernas/masmorras, bueiros, ruínas, acampamentos, passagens e áreas secretas.
- Usar geometria procedural e instâncias para manter o desempenho no navegador e no celular.
- Ajustar biomas e pontos de surgimento para comunicar visualmente a progressão e a dificuldade.

### 3. Tutorial e história conectada
- Criar uma campanha inicial em Aldoria sobre a “Tempestade Partida”, dividida em passos guiados.
- Ensinar, em ordem: movimento, alvo/combate, coleta de loot, inventário/equipamento, magia/hotkey, conversa com NPC, missão e evolução.
- Mostrar objetivo atual, motivo narrativo, progresso, marcador de direção e próxima ação.
- Persistir o avanço no estado de missões do personagem e validar recompensas no servidor.

### 4. Classes, atributos e magias
- Manter Knight, Paladin, Druid, Sorcerer e Rogue com identidade mecânica própria.
- Expandir cada classe para uma progressão de habilidades desbloqueadas por nível.
- Aplicar atributos de equipamento no combate: Vitalidade/Defesa, Precisão/Dano à distância, Cura/Mana, Poder mágico/Mana e Agilidade/Crítico.
- Centralizar todo o conteúdo e fórmulas compartilhadas na estrutura de dados já existente.

### 5. Hotbar 1–0
- Criar dez slots configuráveis para ataque básico, magias e poções.
- Permitir atribuição e troca de ações pelo painel de skills/inventário, com bloqueio por nível, quantidade, mana e cooldown.
- Suportar teclado 1–0 e toque, salvando a configuração por personagem no navegador.

### 6. Equipamentos, raridades e loot
- Adicionar raridade (Comum, Incomum, Raro, Épico e Lendário), nível, vocação recomendada e atributos em cada equipamento.
- Criar conjuntos e armas próprios para as cinco classes em faixas de progressão.
- Ampliar tabelas reais de loot por região; chefes recebem itens exclusivos e probabilidades especiais.
- Exibir raridade e atributos de forma consistente no inventário, NPCs, recompensas e mensagens de loot.
- Manter toda concessão de XP, ouro e itens calculada e validada no servidor.

### 7. Combate, logout e PK
- Criar temporizador de combate renovado ao causar ou receber dano, com indicador visível.
- Bloquear troca de personagem/saída voluntária enquanto o temporizador estiver ativo e avisar o tempo restante.
- Persistir infrações e caveiras no servidor; ataques ilegais geram caveira branca e mortes injustificadas podem gerar caveira vermelha.
- Aplicar consequências existentes de morte/itens/XP e tornar as regras claras na interface.

### 8. Arena PvP funcional
- Criar filas e partidas para 1x1, 2x2, 3x3 e 5x5, com salas persistidas no backend.
- Implementar entrada em fila, formação de equipes, teleporte para mapas variados, contagem regressiva, placar e encerramento.
- Conceder vitória, derrota, XP e recompensa no servidor, sem penalidade de morte ou PK dentro da Arena.
- Adicionar recuperação de partidas abandonadas/expiradas e impedir recompensa duplicada.

### 9. Outfits e Loja Premium
- Liberar gratuitamente seis outfits: padrão e um para cada vocação; personagens existentes também terão acesso.
- Manter roupas Premium, montarias, cosméticos, efeitos e bônus de XP separados dos visuais gratuitos.
- Atualizar o nome do produto no checkout e preservar a confirmação segura do Mercado Pago.

## Dados e segurança
- Adicionar migração para Arena e campos mínimos de combate/progressão que precisarem persistência, com permissões e regras de acesso restritas.
- Escritas sensíveis continuam em funções autenticadas; recompensas, loot, PK e Arena nunca aceitarão resultados finais informados pelo cliente.
- Preservar a arquitetura multiplayer regional atual e não prometer escala de milhares sem servidor dedicado.

## Validação
- Testar criação/entrada de personagem, tutorial inicial, combate e loot, equipar item, desbloqueio e uso de magia, hotkeys 1–0 e bloqueio de saída.
- Testar fila e ciclo completo da Arena com jogadores autenticados quando houver contas suficientes; validar estados alternativos sem forjar resultados.
- Verificar visualmente o mundo em desktop e celular, incluindo iluminação, enquadramento, HUD e ausência de tela vazia.
- Confirmar compilação, erros de execução, rede e persistência antes de concluir.
