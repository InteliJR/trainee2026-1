import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: 'border-operational-100 bg-operational-50 text-operational-800', icon: 'info' },
  success: { box: 'border-brand-200 bg-brand-50 text-brand-800', icon: 'checkCircle' },
  warning: { box: 'border-reward-200 bg-reward-50 text-reward-800', icon: 'alert' },
  error: { box: 'border-danger-100 bg-danger-50 text-danger-800', icon: 'alert' },
};

export function InlineNotice({ tone = 'info', children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  const { box, icon } = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${box}`}>
      <Icon name={icon} className="mt-0.5 h-4 w-4" />
      <div className="flex-1">
        <div className="font-medium">{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
