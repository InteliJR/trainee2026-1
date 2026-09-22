import { translateStatus, type RequestStatus } from '@ecorota/shared';
import { Icon, type IconName } from './Icon';

// Classes literais (o Tailwind precisa enxergá-las). Nunca só cor: sempre ícone + texto.
const STYLE: Record<RequestStatus, { className: string; icon: IconName }> = {
  pending: { className: 'bg-status-pending-bg text-status-pending', icon: 'clock' },
  assigned: { className: 'bg-status-assigned-bg text-status-assigned', icon: 'truck' },
  in_service: { className: 'bg-status-in-service-bg text-status-in-service', icon: 'pin' },
  completed: { className: 'bg-status-completed-bg text-status-completed', icon: 'checkCircle' },
  cancelled: { className: 'bg-status-cancelled-bg text-status-cancelled', icon: 'ban' },
};

/** Único lugar que exibe o status de uma coleta na interface — sempre via `translateStatus`. */
export function StatusBadge({ status, size = 'md' }: { status: RequestStatus; size?: 'md' | 'lg' }) {
  const { className, icon } = STYLE[status];
  const sizing = size === 'lg' ? 'gap-2 px-4 py-2 text-lg' : 'gap-1.5 px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizing} ${className}`}>
      <Icon name={icon} className={size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'} />
      {translateStatus(status)}
    </span>
  );
}
