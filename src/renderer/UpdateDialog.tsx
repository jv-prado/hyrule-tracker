import { useEffect, useState } from 'react';
import type { UpdateState } from '../shared/types';
import { api } from './api';
import { percent, t } from './i18n';

// Asks before downloading and shows the changelog of the new version. Never installs on its own.
export function UpdateDialog() {
  const [u, setU] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    void api.getUpdate().then(setU);
    return api.onUpdate(setU);
  }, []);
  if (u.status === 'idle') return null;

  return (
    <div className="update-backdrop" role="dialog" aria-modal="true" aria-label={t('Nova versão disponível')}>
      <div className="update-card">
        <div className="update-head">
          <span className="update-badge" aria-hidden>⬆</span>
          <div>
            <h2>{u.status === 'ready' ? t('Atualização pronta') : t('Nova versão disponível')}</h2>
            {u.version && <p className="update-version">v{u.version}</p>}
          </div>
        </div>

        {u.status === 'available' && u.notes && (
          <div className="update-notes">
            <h3>{t('Novidades')}</h3>
            <div className="update-notes-text">{u.notes}</div>
          </div>
        )}
        {u.status === 'downloading' && (
          <div className="update-progress">
            <p>{t('Baixando a atualização…')} {percent((u.percent ?? 0) / 100)}</p>
            <div className="update-bar"><div style={{ width: `${u.percent ?? 0}%` }} /></div>
          </div>
        )}
        {u.status === 'ready' && <p>{t('A atualização foi baixada. Reinicie para instalar.')}</p>}
        {u.status === 'error' && <p className="update-error">{t('Não foi possível baixar a atualização.')}</p>}

        <div className="update-actions">
          {(u.status === 'available' || u.status === 'error') && (
            <>
              <button onClick={() => api.updateLater()}>{t('Depois')}</button>
              <button className="primary" onClick={() => api.updateNow()}>{u.status === 'error' ? t('Tentar novamente') : t('Atualizar')}</button>
            </>
          )}
          {u.status === 'ready' && <button className="primary" onClick={() => api.installUpdate()}>{t('Reiniciar e instalar')}</button>}
        </div>
      </div>
    </div>
  );
}
