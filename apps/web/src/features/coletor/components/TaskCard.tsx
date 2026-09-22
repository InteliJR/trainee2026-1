import { useId } from 'react';
import { Link } from 'react-router-dom';
import { buttonClasses } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { StatusBadge } from '../../../components/StatusBadge';
import type { CollectorTask } from '../api';
import { materialLabel } from '../config';

// Card de tarefa (guia: no celular do coletor, cards em vez de tabelas). Texto grande e uma única ação.
export function TaskCard({ task }: { task: CollectorTask }) {
  const titleId = useId();
  const onSite = task.status === 'in_service';
  const materials = task.materials.map(materialLabel).join(', ');

  return (
    <article
      aria-labelledby={titleId}
      className={`space-y-4 rounded-lg border-2 bg-neutral-0 p-4 shadow-card ${onSite ? 'border-brand-600' : 'border-neutral-300'}`}
    >
      <div className="space-y-3">
        <StatusBadge status={task.status} />
        <h3 id={titleId} className="text-xl font-bold text-neutral-900">
          {materials}
        </h3>
        <p className="flex items-start gap-2 text-lg text-neutral-900">
          <Icon name="pin" className="mt-1 h-5 w-5" />
          <span>
            {task.pointName}
            <span className="block text-base text-neutral-700">Circuito {task.circuit}</span>
          </span>
        </p>
      </div>

      <Link to={`/coletor/coletas/${task.id}`} className={buttonClasses(onSite ? 'primary' : 'secondary', true, 'lg')}>
        Ver detalhes
        <span className="sr-only">
          : {materials} em {task.pointName}
        </span>
        <Icon name="chevronRight" />
      </Link>
    </article>
  );
}
