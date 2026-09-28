/**
 * Mapa pequeno da tela "Acompanhar status": mostra o ponto da coleta e o caminhão chegando.
 * Reaproveita o MapContainer do painel, restrito ao ponto e ao coletor da solicitação do morador.
 */
import type { Collector, Point } from '@ecorota/shared';
import { useEffect, useState } from 'react';
import { MapContainer } from '../../../map/MapContainer';
import { distanceMeters, formatAge, formatDistance } from '../../../map/mapUtils';
import { Icon } from './Icon';

interface ResidentLiveMapProps {
  point: Point;
  collector: Collector | null;
}

// Desenha o card com o mapa e uma linha de resumo com distância e idade da última posição.
export function ResidentLiveMap({ point, collector }: ResidentLiveMapProps) {
  // Atualiza o texto "há X" mesmo quando nenhuma posição nova chega.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const position = collector?.position?.coordinates ?? null;
  const summary = position
    ? `Coletor a ${formatDistance(distanceMeters(position, point.coordinates))} do ponto · posição ${formatAge(collector!.observedAt, now)}`
    : 'Aguardando a posição do coletor.';

  return (
    <section className="mt-6 border-t border-neutral-200 pt-4" aria-label="Coletor ao vivo">
      <h3 className="flex items-center gap-2 text-base font-bold text-neutral-950">
        <Icon name="truck" className="h-5 w-5 text-brand-700" />
        Coletor ao vivo
      </h3>
      <p className="mt-1 text-sm text-neutral-600">{summary}</p>
      <div className="mt-3 h-64 overflow-hidden rounded-md border border-neutral-200">
        <MapContainer
          points={[point]}
          collectors={collector && position ? [collector] : []}
          center={point.coordinates}
          zoom={14}
          minHeight="16rem"
        />
      </div>
    </section>
  );
}
