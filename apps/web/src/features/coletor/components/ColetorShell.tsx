import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { synchronizeCollectorQueue } from '../api/offlineApi';
import { discardFailedAction, pendingActions } from '../api/offlineQueue';

// Casca da área do coletor: cabeçalho de alto contraste, conteúdo de uma coluna e navegação inferior.
// Navegação do guia de estilos: Hoje, Disponível, Perfil. "Sair" fica dentro do Perfil, com confirmação.
export function ColetorShell() {
  const [queue, setQueue] = useState(() => pendingActions());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setQueue(pendingActions());
    const synchronize = () => {
      setOnline(navigator.onLine);
      void synchronizeCollectorQueue().catch(update);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') synchronize();
    };
    const onStorage = () => {
      update();
      synchronize();
    };
    window.addEventListener('collector-queue-change', update);
    window.addEventListener('online', synchronize);
    window.addEventListener('offline', synchronize);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && pendingActions().length) synchronize();
    }, 30_000);
    synchronize();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('collector-queue-change', update);
      window.removeEventListener('online', synchronize);
      window.removeEventListener('offline', synchronize);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const failed = queue.find((action) => action.error);
  const queueCount = `${queue.length} ${queue.length === 1 ? 'ação' : 'ações'}`;
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 bg-brand-700 text-white">
        <div className="mx-auto flex max-w-app items-center justify-between px-screen py-3">
          <Link to="/coletor" className="min-h-touch flex items-center text-xl font-bold">
            EcoRota
          </Link>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-brand-800">Coletor</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-app flex-1 px-screen pb-10 pt-section">
        {!online && <div className="mb-4"><InlineNotice tone="warning">Sem conexão. As coletas já carregadas continuam disponíveis.</InlineNotice></div>}
        {queue.length > 0 && (
          <div className="mb-4">
            <InlineNotice tone={failed ? 'error' : 'info'} action={failed && (
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  discardFailedAction(failed.id);
                  void synchronizeCollectorQueue().catch(() => {
                    // A fila permanece salva para a próxima tentativa.
                  });
                }}
              >
                Descartar ação com erro
              </button>
            )}>
              {failed
                ? `${queueCount} na fila. Sincronização pausada: ${failed.error}`
                : `${queueCount} aguardando sincronização.`}
            </InlineNotice>
          </div>
        )}
        <Outlet />
      </main>

      <nav aria-label="Navegação principal" className="sticky bottom-0 z-10 border-t border-neutral-300 bg-neutral-0">
        <div className="mx-auto flex max-w-app">
          <NavTab to="/coletor" end icon="home" label="Hoje" />
          <NavTab to="/coletor/disponibilidade" icon="checkCircle" label="Disponível" />
          <NavTab to="/coletor/perfil" icon="user" label="Perfil" />
        </div>
      </nav>
    </div>
  );
}

function NavTab({ to, end, icon, label }: { to: string; end?: boolean; icon: IconName; label: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-touch-lg flex-1 flex-col items-center justify-center gap-1 text-sm font-semibold ${
          isActive ? 'text-brand-700' : 'text-neutral-600 hover:text-brand-700'
        }`
      }
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}
