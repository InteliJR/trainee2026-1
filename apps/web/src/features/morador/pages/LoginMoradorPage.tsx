import { RoleLoginPage } from '../../../components/RoleLoginPage';
import { Icon } from '../components/Icon';
import { loginResident } from '../lib/residentAuth';

// Login do morador. Depois de entrar, volta para a tela que pediu o acesso (ou para "Solicitar").
export function LoginMoradorPage() {
  return (
    <RoleLoginPage
      eyebrow="Morador"
      title="Entrar no EcoRota"
      description="Solicite coletas, acompanhe o coletor ao vivo e veja o impacto do que você recicla."
      icon={<Icon name="leaf" className="h-6 w-6" />}
      defaultRedirect="/morador"
      onLogin={loginResident}
    />
  );
}
