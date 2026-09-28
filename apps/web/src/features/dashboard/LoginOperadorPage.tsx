import { Icon } from '../../components/Icon';
import { RoleLoginPage } from '../../components/RoleLoginPage';
import { loginOperator } from './operatorAuth';

// Login do operador, no mesmo layout do login do morador. Depois de entrar, abre o dashboard.
export function LoginOperadorPage() {
  return (
    <RoleLoginPage
      eyebrow="Operador"
      title="Entrar na operação"
      description="Acompanhe coletores, solicitações e indicadores da EcoRota em tempo real."
      icon={<Icon name="truck" className="h-6 w-6" />}
      defaultRedirect="/dashboard"
      onLogin={loginOperator}
    />
  );
}
