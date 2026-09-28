import { useNavigate } from 'react-router-dom';
import { logoutResident } from '../lib/residentAuth';
import { Icon } from './Icon';

type ResidentNavItem = 'inicio' | 'solicitar' | 'status' | 'historico';

interface ResidentBottomNavProps {
  activeItem: ResidentNavItem;
}

const navItems = [
  { id: 'inicio', label: 'Início', href: '/morador', icon: 'home' },
  { id: 'solicitar', label: 'Solicitar', href: '/morador/solicitar', icon: 'trash' },
  { id: 'status', label: 'Acompanhar', href: '/morador/acompanhar', icon: 'route' },
  { id: 'historico', label: 'Histórico', href: '/morador/historico', icon: 'history' },
] as const;

export function ResidentBottomNav({ activeItem }: ResidentBottomNavProps) {
  const navigate = useNavigate();

  // Sai mesmo se a API não responder, para não prender o morador numa sessão que ele quer encerrar.
  async function logout() {
    await logoutResident().catch(() => undefined);
    navigate('/morador/login', { replace: true });
  }

  return (
    <nav
      aria-label="Navegação do morador"
      className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 px-screen py-2 shadow-card backdrop-blur"
    >
      <div className="mx-auto grid max-w-app grid-cols-5 gap-1 text-xs font-semibold text-neutral-600">
        {navItems.map((item) => {
          const isActive = item.id === activeItem;
          const className = [
            'flex min-h-touch flex-col items-center justify-center gap-1 rounded-md transition',
            isActive
              ? 'bg-brand-600 text-white shadow-card'
              : 'text-neutral-600 hover:bg-brand-50 hover:text-brand-700',
            item.href ? '' : 'text-neutral-400',
          ].join(' ');

          return (
            <a className={className} href={item.href} key={item.id}>
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </a>
          );
        })}
        <button
          className="flex min-h-touch flex-col items-center justify-center gap-1 rounded-md text-neutral-600 transition hover:bg-brand-50 hover:text-brand-700"
          onClick={() => void logout()}
          type="button"
        >
          <Icon name="arrow-left" className="h-5 w-5" />
          Sair
        </button>
      </div>
    </nav>
  );
}
