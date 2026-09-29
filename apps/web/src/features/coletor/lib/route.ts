/**
 * Navegação até o destino da coleta. O traçado pelas ruas fica com o app de mapas do celular,
 * aberto só quando o coletor toca no botão. A posição do coletor vai só para a API da plataforma,
 * que a repassa ao painel do operador; nenhum serviço externo a recebe.
 */

import { distanceMeters } from '../../../map/mapUtils';

// Link do Google Maps com a rota até o destino ([longitude, latitude]); sem origem, o app usa a posição atual.
export function directionsUrl(destination: [number, number], origin?: [number, number] | null): string {
  const [lng, lat] = destination;
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin[1]},${origin[0]}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}


// Última posição enviada à API: onde e quando.
export interface SentPosition {
  coordinates: [number, number];
  at: number;
}

// Envia na primeira leitura, depois a cada 15 s ou quando o coletor anda 25 m (nunca antes de 3 s),
// para o painel acompanhar sem gastar bateria e dados à toa.
export function shouldSendPosition(last: SentPosition | null, next: [number, number], now: number): boolean {
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed < 3_000) return false;
  return elapsed >= 15_000 || distanceMeters(last.coordinates, next) >= 25;
}
