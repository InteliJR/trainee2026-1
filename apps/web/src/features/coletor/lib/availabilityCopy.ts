import type { SyncStatus } from '../api';

interface SyncCopy {
  tone: 'success' | 'info' | 'warning';
  title: string;
  text: string;
}

// A EcoRota é quem de fato distribui as coletas: sincronizar é o que garante que ela saiba do seu status.
// O InlineNotice já mostra um ícone pelo tom; aqui só o texto.
export const SYNC_STATUS_COPY: Record<SyncStatus, SyncCopy> = {
  SYNCED: {
    tone: 'success',
    title: 'Sincronizado com a EcoRota',
    text: 'A EcoRota já está usando esse status para decidir se te atribui novas coletas.',
  },
  PENDING: {
    tone: 'info',
    title: 'Sincronizando com a EcoRota…',
    text: 'Ainda confirmando esse status por lá. Pode levar alguns instantes, a tela atualiza sozinha.',
  },
  ERROR: {
    tone: 'warning',
    title: 'Não sincronizou com a EcoRota',
    text: 'A EcoRota pode não saber desse status ainda, então você pode continuar recebendo coletas por lá mesmo indisponível aqui.',
  },
};
