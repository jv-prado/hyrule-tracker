# Cobertura do remake de Ocarina of Time

Pesquisa de 16 de novembro de 2026 para a versão de Nintendo Switch 2. Os dados extraídos localmente foram consultados em modo de leitura. A cena de jogo e o catálogo de GameData sustentam as contagens técnicas. Os guias publicados ajudam a dar nomes, situar os itens e distinguir o remake do original.

## História e missões

O guia de conclusão agrupa a história em cinco missões principais com subetapas e inclui sete secundárias. O catálogo do jogo, `RSDB/Challenge.Product.111.rstbl.byml.zs`, contém 45 registros. Vinte têm `IsCompleteTarget=true`. Todos os 45 têm enum `Step_<ID>` com estado `Complete` em GameData. Um desafio jogável, um trecho da tapeçaria e um passo do diário podem ter granularidades diferentes. [Guia de conclusão](https://nintendoeverything.com/zelda-ocarina-of-time-100-percent-completion-guide/) · [Threads of Time](https://zeldacollection.de/en/walkthroughs/ocarina-of-time-switch-2/threads-of-time/) · [Registro por missão](https://zelda.mtwildwood.net/en-gb/quests/)

| Arco | IDs principais confirmados |
| --- | --- |
| A Grande Árvore Deku | `Meet_DekuTree`, `Get_StoneOfForest` |
| Princesa de Hyrule | `Goto_HyruleCastle` |
| Pedras espirituais e Porta do Tempo | `Get_StoneOfFire`, `Get_StoneOfWater`, `DoorOfTime` |
| Despertar dos sábios | `AllSage`, `SageOfForest`, `SageOfFire`, `SageOfWater`, `SageOfShadow`, `SageOfSpirit` |
| Luz e escuridão | `Defeat_Ganon` |

O despertar do Sábio da Luz tem `Step_SageOfLight`. A fuga da torre tem `Step_EscapeFromCrumblingGanonCastle` e fica fora da listagem normal do diário. Para os textos localizados dos arcos, o remake tem português do Brasil, inglês e espanhol. [Lançamento brasileiro](https://www.nintendo.com/pt-br/whatsnew/chegou-a-hora-jogue-the-legend-of-zelda-ocarina-of-time-renascido-exclusivamente-para-o-nintendo-switch-2/) · [Guia dos capítulos](https://zeldacollection.de/en/walkthroughs/ocarina-of-time-switch-2/threads-of-time/)

| Secundária | ID de GameData |
| --- | --- |
| Amiga de Malon e Epona | `Step_Get_Epona` |
| Loja de máscaras | `Step_SubEvent_MaskSalesman` para conclusão e vendas. Em saves sem o passo, o empréstimo da próxima máscara confirma a venda anterior. |
| Ao encontro da Grande Fada | Concluída só com as 6 fontes das Grandes Fadas (mesmas regras da categoria Grandes Fadas); a página mostra o progresso N/6. |
| Canção da Família Real | `Step_SubEvent_GetMelodySun` |
| Canção do espantalho | `Step_SubEvent_GetScarecrow` |
| Trocas até a espada de Biggoron | `Step_SubEvent_GetSwordBigGoron` |
| Moinho, Canção das Tempestades e poço | `Step_SubEvent_GetStormSong` |

Eventos paralelos identificados no catálogo incluem os 100 tokens (`GatheringTokenGold`), o tutorial da garrafa do mercado (`Market_Item_Bottle_TutorialEvent`), a devolução do cachorro Richard (`SubEvent_FindRichard`), as flechas de fogo e gelo (`SubEvent_GetFireArrow`, `SubEvent_GetIceArrow`), a Lente da Verdade (`SubEvent_GetGlassTruth`), o colecionador de Poes (`SubEvent_GhostShop`), a corrida do carteiro (`SubEvent_RunningRace`) e o salão (`SubEvent_AllBossBattle`). A conclusão de vários também é visível no inventário. [Guia de missões e atividades](https://questfern.com/oot/guides/side-quests/) · [Rotas principais e opcionais](https://hyruleatlas.com/ocarina-of-time-switch-2/)

## Atividades opcionais

Para um jogo repetível, uma flag de prêmio ou recorde oferece uma confirmação mais estável que o estado da partida em andamento. Os nomes de flags abaixo foram encontrados no catálogo local como campos de save. Para contas ou flags sem teste de jogo após sair do minijogo, o checklist pode aceitar uma marcação manual. Os limiares do tiro a cavalo são 750 para o coração e 1.400 para a aljava no remake. [Minijogos do remake](https://zelda.mtwildwood.net/minigames/) · [Diálogo do tiro a cavalo](https://zelda.mtwildwood.net/en-gb/characters/horseback-archery-attendant/) · [Prêmios do remake](https://questfern.com/oot/guides/side-quests/)

| Atividade | Verificação local ou alvo |
| --- | --- |
| Galeria de tiro, criança | `MiniGame_HitTarget_HrlCity_FirstTimeClear`, `MiniGame_HitTarget_HrlCity_Get_BulletBag` e `MiniGame_HitTarget_BestScore`. Modo especialista com marcação manual |
| Galeria de tiro, adulto | `MiniGame_HitTarget_Kakariko_FirstTimeClear`, `MiniGame_HitTarget_Kakariko_Get_Quiver` e `MiniGame_HitTarget_Kakariko_BestScore`. Modo especialista com marcação manual |
| Boliche Bombchu | Três vitórias registradas por `MiniGame_BombchuBowling_ClearFirstTime`, `ClearSecondTime` e `ClearThirdTime` com o mesmo prefixo |
| Loja de baús | Pedaço de Coração do baú final ou `Step_MiniGame_SequentialChoiceTreasure` concluído |
| Pesca, criança e adulto | `MiniGame_Fishing_GetHeartPiece` e `MiniGame_Fishing_GetGoldScale`. Os recordes de tamanho e de captura de loach podem ter linhas próprias |
| Tiro a cavalo | `MiniGame_HorsebackArchery_GotaHeart`, `MiniGame_HorseBackArchery_Get_Quiver` e `MiniGame_HorsebackArchery_BestScore` |
| Escavação do Dampé | `GraveYard_DiggingHoleTour_Drop_HeartPiece` no desafio `MiniGame_DiggingHole` |
| Corrida do Dampé | `MiniGame_DampeRace_ClearCount` e `UnderTheGrave_DampeRace_HeartGeted`. O primeiro prêmio é o Hookshot |
| Mergulho dos Zora | `MiniGame_Diving_ShilverScale_First` no desafio `MiniGame_Diving` |
| Sapos de Zora River | `MiniGame_FrogTenors_StormSong` e `MiniGame_FrogTenors_InsectRepellent_ClearAfter`. Cinco canções comuns desbloqueiam o jogo de notas |
| Ingo | `Step_Get_Epona` e desafio `MiniGame_GambleRace` |
| Percurso de obstáculos | Recorde abaixo de 40 segundos pelos campos `MiniGame_HorseRace_BestTime_Minutes` e `MiniGame_HorseRace_BestTime_Second`, ou interação com a vaca na casa de Link |
| Alvo no Bosque Perdido | `LostWood_HitTargetOfDekuScrub_FirstClear` |
| Dueto com Skull Kids | `Minigame_SkullKidSession_IsGetHeartPiece` |
| Teatro Deku | Marcação manual de duas interações de prêmio, com a Skull Mask e a Mask of Truth |
| Super Cucco | `IsClear_Minigame_FindOutCucco` no desafio `Minigame_FindOutCucco` |
| Cuccos de Kakariko | `MiniGame_CatchCucco_IsCompleted` no desafio `Minigame_CatchCucco` |
| Running Man | `Subevent_RunningRace_HaveFinished` e campos de tempo |
| Corrida chefe a chefe | Três provações do salão |

A exploração opcional inclui dez pontos de plantio de feijões, dez Big Poes, as trocas das máscaras e de Biggoron, os quatro carpinteiros, quatro grupos de itens de masmorra (mapas, bússolas, chaves pequenas e chaves de chefe), rupees prateadas e quebra-cabeças, vacas leiteiras, vendedores Deku e as pedras falantes. A recompensa pelos Big Poes muda na versão Switch 2. O colecionador dá uma garrafa com 500 pontos e uma rupee dourada de valor 200 aos 1.000. Use o contador salvo ou o mapa dos dez pontos quando houver rastreamento individual. [Big Poes no remake](https://questfern.com/oot/guides/big-poes/) · [Mapa de baús e outras categorias](https://zeldacollection.de/en/walkthroughs/ocarina-of-time-switch-2/interactive-map/) · [Inventário, rupees e vendedores](https://zelda.mtwildwood.net/en-gb/checklist/)

## Exploração e colecionáveis

| Categoria | Total e evidência |
| --- | --- |
| Corações | 36 pedaços e oito recipientes de chefes levam de três a 20 corações máximos. [Checklist do remake](https://questfern.com/oot/guides/100-percent-checklist/) |
| Skulltulas douradas | 100. O remake muda a localização de algumas e tem uma sequência no Campo de Hyrule que começa na infância e termina na fase adulta. [Localizações no remake](https://questfern.com/oot/guides/gold-skulltulas/) |
| Canções | 12 melodias fixas e uma personalizada para o espantalho. [Canções do remake](https://questduo.com/the-legend-of-zelda-ocarina-of-time/song-locations/) |
| Equipamento, fadas e garrafas | Seis fontes de Grandes Fadas e cinco garrafas. Registre os níveis de bolsas, aljavas, carteiras e escalas. [Ferramentas e melhorias](https://questfern.com/oot/guides/items-and-upgrades/) |
| Baús | GameData fornece as 206 flags de `IsTreasureBoxOpen` nesta revisão. O mapeamento pode cobrir as posições pelas instâncias de baú de Banc. [Mapa e baús do remake](https://zeldacollection.de/en/walkthroughs/ocarina-of-time-switch-2/interactive-map/) |
| Pensamentos de fada | 23 flags de leitura associadas a atores distintos. Variações do mesmo pensamento e estados de diálogo compartilham o item. [Guia de 23 pensamentos](https://powerupgaming.co.uk/2026/11/10/ocarina-of-time-remake-fairy-thoughts-explained/) |
| Espantalhos | 16 atores de invocação com flags `Appear_SCARECROW_*` válidas no arquivo de progresso. [Localizações observadas](https://questfern.com/oot/guides/scarecrow-song/) |
| Entradas subterrâneas | O guia lista 36 grutas, dez ainda reportadas sem confirmação daquele autor. Banc tem 37 posições únicas de `LookAttentionActor_HidingHoleEntrance` ao mesclar as eras, incluindo entradas relacionadas a outros eventos. Trate o conjunto de posições como pontos de mapa e evite declarar que todas são grutas de progresso. O único estado global `HidingHole_IsInPlayer` identifica ocupação. `IsOpenHole` tem apenas quatro membros no catálogo, insuficientes para a cobertura de grutas. [Guia de grutas e entradas](https://questfern.com/oot/guides/secret-grottos/) |

### Pensamentos de fada

Verificação direta pela relação `HrlField_Note_NN` → `HaveReadHrlField_NoteNN` em Banc e GameData. O identificador 01 pertence ao jardim de Lon Lon e 06 à margem de Lake Hylia, apesar de ambos estarem arquivados em Banc de Hyrule Field. O pensamento 19 tem duas instâncias na mesma sala que usam a mesma flag. Uma compilação comunitária anterior publica 19 flags. As quatro adicionais de Zora River, Forest Temple, Fire Temple e Water Temple estão nos arquivos do jogo e em fotografias de gameplay. [Mapa de 19 do Nintendúo](https://www.nintenduo.com/juegos/the-legend-of-zelda-ocarina-of-time/mapa/en/fairy-thoughts/) · [Flags do Atlas](https://github.com/antonioalvromero/Ocarina-Atlas/blob/main/src/lib/lichii-server.ts#L960-L987) · [Guia dos 23](https://powerupgaming.co.uk/2026/11/10/ocarina-of-time-remake-fairy-thoughts-explained/)

| Banc / região | Identificadores e locais |
| --- | --- |
| Campo de Hyrule | 00 carroça dos insetos, 02 rochas a oeste do fosso, 04 ruína junto à ponte, 07 árvore junto ao vendedor Deku, 08 ruínas a caminho do lago, 09 reentrância próxima ao rio, 10 abrigo dos Peahats, 11 caverna do baú perto de Gerudo, 12 gruta do lago ao sul, 15 ruína junto à cerca do rancho |
| Rancho Lon Lon e Lago Hylia | 01 muro do jardim, 06 alcova dos vasos a oeste do lago |
| Cemitério | 16 ruínas da entrada do túmulo real, 26 pedestal interno |
| Trilha da Montanha da Morte e Colosso do Deserto | 14 espiral de folhas perto da cidade Goron, 25 patamar do Templo dos Espíritos |
| Rio Zora e Fundo do Poço | 13 parede próxima ao trecho de terra, 23 caixão da sala de Gibdo |
| Floresta, Fogo e Água | 19 sala azul giratória, 20 parede do salão do martelo, 22 plataforma no primeiro andar |
| Sombras e Caverna de Gelo | 24 sala do teto com espinhos, 21 túnel ao lado da sala da bússola |

### Espantalhos

As 16 colocações filtradas usam `Npc_Pierre_CallOcarina` com `Presence.FlagName` iniciado por `Appear_SCARECROW_`. Duas colocações de cena chamadas `Right` e `Left` ficam fora do grupo, pois não correspondem a flags de progresso da invocação. O catálogo confirma duas na cratera, três no Lago Hylia e duas no Templo das Sombras. As demais se distribuem entre a Caverna dos Dodongos, os Templos do Fogo, da Floresta, da Água e dos Espíritos, a Fortaleza e o Campo de Treinamento Gerudo, a Clareira Sagrada e a Fonte Zora. A presença de uma flag no save sustenta a leitura. A duração entre transições ainda precisa de teste em jogo. [Guia e fotos das invocações](https://questfern.com/oot/guides/scarecrow-song/)

## Salão dos Inimigos

A história libera o salão ao receber o Medalhão da Floresta e aprender o Prelúdio da Luz. São 84 pedestais de monstros no arquivo `Banc/DreamWorld/EnemyMuseum_Static.bcett.byml.zs`. Os registros de desafio individual são 25 na estrutura persistente `DreamWorld_TimeTrial`, com um booleano `HaveRecordedTime` e dois valores de ponto flutuante por desafio. O membro de hash `0xACC97DDA` resolve para `BestTimeFrame`. Os rótulos de equipe `EnemyTeam_IronKnuckle` e `EnemyTeam_Twinrova` resolvem as chaves `0x695A031E` e `0x9C44144A`. A revanche de Stalfos é `Enemy_Stalfos` (`0x3E08A48B`). As três provações têm campos de tempos próprios. São Pedras Espirituais (3 chefes), Cinco Sábios (5) e Herói do Tempo (10). Recordes e medalhas oficiais de classificação online são recursos do serviço Zelda Notes. [Salão e imagens dos monstros](https://zeldacollection.de/en/walkthroughs/ocarina-of-time-switch-2/hall-of-fallen-foes/) · [Catálogo de combate](https://zelda.mtwildwood.net/en-gb/checklist/) · [Zelda Notes da Nintendo](https://www.nintendo.com/en-gb/Games/Smart-device-games/ZELDA-NOTES-2790439.html)

## Referência funcional de Zelda Notes

A Nintendo anuncia onze áreas para este remake. O mapa permite localizar itens perdidos e ocultar locais não visitados. Rumores usam referências visuais e recompensam com partituras. O salão mostra chefes, melhores tempos e classificação. O registro diário guarda eventos e fotos. Dados pessoais e globais mostram marcos e comparações. O estúdio decora fotos. Fios do Tempo+ resume a história e permite rever cenas. Os recursos adicionais são os scans amiibo, a ocarina com três modos e partituras compartilháveis, e o quiz em duas dificuldades. Para um app offline, capturas, partituras, registros, perguntas e comparações podem ser locais. A API de conta, o placar da Nintendo, o banco oficial de perguntas e os bônus concedidos pelo servidor continuam sendo recursos do serviço oficial. [Onze áreas oficiais e detalhes](https://www.nintendo.com/en-gb/Games/Smart-device-games/ZELDA-NOTES-2790439.html) · [Visão geral do remake](https://www.nintendo.com/us/whatsnew/its-time-experience-the-legend-of-zelda-ocarina-of-time-reborn-exclusively-for-nintendo-switch-2/)
