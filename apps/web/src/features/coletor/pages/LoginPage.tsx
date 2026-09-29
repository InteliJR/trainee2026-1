import { RoleLoginPage } from '../../../components/RoleLoginPage';
import { Icon } from '../../../components/Icon';
import { loginCollector } from '../lib/collectorAuth';

// Login do coletor (RF01/RF02). Sem cadastro: coletores custom são cadastrados pelo time.
export default function LoginPage() {
  return (
    <RoleLoginPage
      eyebrow="Coletor"
      title="Entrar no EcoRota"
      description="Veja as coletas do dia, atualize o status de cada uma e organize sua disponibilidade."
      icon={<Icon name="truck" className="h-6 w-6" />}
      defaultRedirect="/coletor"
      onLogin={loginCollector}
    />
  );
}
