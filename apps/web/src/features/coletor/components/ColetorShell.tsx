import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../../components/Icon';
import { useAuth } from '../auth/AuthContext';

// Casca da área do coletor: cabeçalho de alto contraste, conteúdo de uma coluna e navegação inferior.
// Guia de estilos: "Hoje, Disponível, Perfil" — a aba Perfil ainda não existe; nome e "Sair" ficam no cabeçalho.
export function ColetorShell() {
  const { collector, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/coletor/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 bg-brand-700 text-white">
        <div className="mx-auto flex max-w-app items-center justify-between px-screen py-3">
          <Link to="/coletor" className="min-h-touch flex items-center text-xl font-bold">
            EcoRota
          </Link>
          <div className="flex items-center gap-3">
            {collector && <span className="text-sm font-semibold">{collector.name.split(' ')[0]}</span>}
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-touch items-center gap-1 rounded-full bg-white px-3 text-sm font-bold text-brand-800 hover:bg-brand-50"
            >
              <Icon name="logout" className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-app flex-1 px-screen pb-10 pt-section">
        <Outlet />
      </main>

      <nav aria-label="Navegação principal" className="sticky bottom-0 z-10 border-t border-neutral-300 bg-neutral-0">
        <div className="mx-auto flex max-w-app">
          <NavTab to="/coletor" end icon="home" label="Hoje" />
          <NavTab to="/coletor/disponibilidade" icon="checkCircle" label="Disponível" />
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
