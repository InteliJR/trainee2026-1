/**
 * Tela inicial: a pessoa escolhe a própria área (morador, coletor ou operador) e vai para o login dela.
 * Segue o guia de estilos: ação principal evidente, alvos grandes, sem composição promocional.
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';

interface ProfileOption {
  to: string;
  icon: IconName;
  title: string;
  description: string;
  // Cor de destaque da área: marca para o morador e o coletor, operacional para o dashboard.
  tileClassName: string;
}

const OPTIONS: ProfileOption[] = [
  {
    to: '/morador/login',
    icon: 'home',
    title: 'Sou morador',
    description: 'Solicitar coleta, acompanhar o coletor e ver meu impacto.',
    tileClassName: 'bg-brand-600',
  },
  {
    to: '/coletor/login',
    icon: 'truck',
    title: 'Sou coletor',
    description: 'Ver as coletas do dia, confirmar retiradas e informar disponibilidade.',
    tileClassName: 'bg-brand-700',
  },
  {
    to: '/operador/login',
    icon: 'list',
    title: 'Sou operador',
    description: 'Acompanhar coletores, solicitações e indicadores em tempo real.',
    tileClassName: 'bg-operational-700',
  },
];

export function EscolhaPerfilPage() {
  return (
    <main className="eco-page flex min-h-screen flex-col justify-center px-screen py-section text-neutral-900">
      <div className="mx-auto w-full max-w-app">
        <p className="text-sm font-semibold uppercase text-brand-700">EcoRota</p>
        <h1 className="mt-1 text-3xl font-bold">Como você quer entrar?</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">Escolha sua área para continuar.</p>

        <nav aria-label="Escolha de perfil" className="mt-section">
          <ul className="space-y-3">
            {OPTIONS.map((option) => (
              <li key={option.to}>
                <Link
                  to={option.to}
                  className="eco-card flex min-h-touch-lg items-center gap-4 rounded-lg p-4 pl-5 transition hover:border-brand-300"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-neutral-0 ${option.tileClassName}`}
                  >
                    <Icon name={option.icon} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-neutral-900">{option.title}</span>
                    <span className="mt-0.5 block text-sm text-neutral-600">{option.description}</span>
                  </span>
                  <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
