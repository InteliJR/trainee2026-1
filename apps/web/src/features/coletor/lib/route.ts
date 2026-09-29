/**
 * Navegação até o destino da coleta. O traçado pelas ruas fica com o app de mapas do celular,
 * aberto só quando o coletor toca no botão; o app EcoRota não envia a posição a serviços externos.
 */

// Link do Google Maps com a rota até o destino ([longitude, latitude]); sem origem, o app usa a posição atual.
export function directionsUrl(destination: [number, number], origin?: [number, number] | null): string {
  const [lng, lat] = destination;
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin[1]},${origin[0]}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
