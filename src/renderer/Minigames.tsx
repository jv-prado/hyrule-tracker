import { useState } from 'react';
import type { AppState, TrackedItem } from '../shared/types';
import { api } from './api';
import { GameItemIcon } from './GameItemIcon';
import { number, t } from './i18n';
import { ObjectiveName } from './ObjectiveName';

const games = [
  ['Tiro ao alvo no Mercado', 'fairy_slingshot', 'shooting_child', 'shooting_child_upgrade', 'shooting_child_expert'],
  ['Tiro ao alvo em Kakariko', 'fairy_bow', 'shooting_adult', 'shooting_adult_upgrade', 'shooting_adult_expert'],
  ['Boliche de Bombchu', 'bombchus', 'bowling_first', 'bowling_second', 'bowling_third'],
  ['Jogo dos baús', 'chest', 'chest_game'],
  ['Pesca', 'golden_scale', 'fishing_child', 'fishing_adult'],
  ['Tiro a cavalo', 'biggest_quiver', 'archery_750', 'archery_1400'],
  ['Escavação de Dampé', 'heart_piece', 'dampe_dig'],
  ['Corrida de Dampé', 'hookshot', 'dampe_race_win', 'dampe_race'],
  ['Mergulho dos Zora', 'silver_scale', 'diving'],
  ['Sapos do Rio Zora', 'ocarina_of_time', 'frogs_storm', 'frogs_song'],
  ['Corrida de Ingo', 'eponas_song', 'ingo_race'],
  ['Pista com obstáculos do Rancho Lon Lon', 'lon_lon_milk', 'obstacle_course'],
  ['Alvo do Bosque Perdido', 'bigger_deku_seed_bag', 'lost_woods_target'],
  ['Teatro Deku', 'mask_of_truth', 'theater_skull', 'theater_truth'],
  ['Encontre o Super Cucco', 'lon_lon_milk', 'super_cucco'],
  ['Reúna os Cuccos de Kakariko', 'bottle', 'cucco_lady'],
  ['Sessão musical dos Skull Kids', 'fairy_ocarina', 'skull_kid'],
  ['Corrida com o corredor', 'gold_rupee', 'running_man'],
] as const;

const filters = [['all', 'Todos'], ['cleared', 'Já concluídos'], ['pending', 'Sem conclusão']] as const;

export function Minigames({ state }: { state: AppState }) {
  const [filter, setFilter] = useState<typeof filters[number][0]>('all');
  const category = state.categories.find(c => c.id === 'minigames');
  if (!category) return <section className="focus-panel"><p className="quiet">{t('Encontre um save para ver os minijogos.')}</p></section>;

  const byId = new Map(category.items.map(item => [item.id, item]));
  const cards = games.map(([name, icon, ...ids]) => {
    const objectives = ids.map(id => byId.get('minigames.' + id)).filter((item): item is TrackedItem => item !== undefined);
    const done = objectives.filter(item => item.done).length;
    return { name, icon, objectives, done, score: state.companion?.minigameScores?.[ids[0]], id: ids[0] };
  });
  const completed = cards.filter(card => card.done > 0).length;
  const visible = cards.filter(card => filter === 'all' || (filter === 'cleared' ? card.done > 0 : card.done === 0));
  return <>
    <div className="section-line minigame-controls">
      <div className="segment" role="group" aria-label={t('Filtrar minijogos')}>
        {filters.map(([id, label]) => <button key={id} aria-pressed={id === filter} onClick={() => setFilter(id)}>{t(label)}</button>)}
      </div>
      <span className="quiet">{completed}/{cards.length} {t('com conclusão registrada')}</span>
    </div>
    <div className="minigame-grid">
      {visible.map(({ id, name, icon, objectives, done, score }) => <section className="focus-panel minigame-card" key={id}>
        <div className="minigame-heading">
          <GameItemIcon id={icon} size={35} />
          <div>
            <h2><ObjectiveName done={done > 0}>{t(name)}</ObjectiveName></h2>
            <small>{t(objectives[0]?.chapter ?? '')}</small>
          </div>
          <b>{done}/{objectives.length}</b>
        </div>
        {score != null && score > 0 && <p className="minigame-score">{t('Melhor pontuação')} <b>{number(score)}</b></p>}
        <ul className="minigame-objectives">
          {objectives.map(item => <MinigameObjective item={item} key={item.id} />)}
        </ul>
      </section>)}
    </div>
    {!visible.length && <p className="quiet">{t('Nenhum minijogo neste filtro.')}</p>}
  </>;
}

function MinigameObjective({ item }: { item: TrackedItem }) {
  const manual = item.manual || item.state === 'unmapped' || item.state === 'unknown';
  const status = item.done ? item.manual ? 'Marcado manualmente' : 'Concluído' : manual ? 'Sem resultado no save' : 'Pendente';
  return <li>
    <span>
      <ObjectiveName done={item.done}>{t(item.name)}</ObjectiveName>
      <small>{t(status)}</small>
    </span>
    {manual && <button type="button" className="action" onClick={() => void api.toggleManual(item.id)}>{t(item.done ? 'Desmarcar' : 'Marcar')}</button>}
  </li>;
}
