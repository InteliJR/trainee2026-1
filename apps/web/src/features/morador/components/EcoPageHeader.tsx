import { Icon } from './Icon';

interface EcoPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  metric?: string;
  metricLabel?: string;
}

export function EcoPageHeader({
  eyebrow,
  title,
  description,
  metric,
  metricLabel,
}: EcoPageHeaderProps) {
  return (
    <header className="eco-hero rounded-lg p-4 text-white sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/18 text-white shadow-card ring-1 ring-white/25">
            <Icon name="cycle" className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-brand-100">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-50">{description}</p>
          </div>
        </div>

        {metric && metricLabel ? (
          <div className="rounded-lg border border-white/25 bg-white/15 px-4 py-3 text-right shadow-card">
            <span className="block text-xl font-bold text-white">{metric}</span>
            <span className="text-xs font-semibold uppercase text-brand-100">{metricLabel}</span>
          </div>
        ) : null}
      </div>
      <div className="eco-section-rule mt-4 h-1 rounded-full" />
    </header>
  );
}
