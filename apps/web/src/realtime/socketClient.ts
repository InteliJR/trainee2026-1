/**
 * Contratos e fábrica do cliente Socket.IO usado pelo React.
 * O arquivo centraliza os eventos públicos em português e impede que a interface trabalhe com dados `unknown`.
 */
import type { Collector, CollectorPosition, Point } from '@ecorota/shared';
import { io, type Socket } from 'socket.io-client';
import { currentAreaRole, type Role } from '../lib/area';

// Define os valores necessários para criar uma conexão de tempo real no frontend.
export interface RealtimeClientOptions {
  // Permite substituir a URL configurada no ambiente, principalmente em testes ou previews.
  apiUrl?: string;
  // Papel da sessão usada no handshake; sem ele, vale o da tela aberta.
  role?: Role;
}

// Restringe o status técnico recebido dentro dos snapshots da EcoRota.
export type RealtimeRequestStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'cancelled';

// Representa uma solicitação presente no estado integral da operação.
export interface RealtimeRequest {
  // Identifica a solicitação dentro da EcoRota.
  id: string;
  // Identifica o ponto em que o material será coletado.
  pointId: string;
  // Relaciona a solicitação externa ao registro salvo pelo backend.
  externalReference: string;
  // Informa o estágio atual da coleta.
  status: RealtimeRequestStatus;
  // Identifica o coletor atribuído ou usa null enquanto ela aguarda atendimento.
  collectorId: string | null;
  // Registra quando a solicitação foi criada no serviço externo.
  createdAt: string;
  // Registra o instante da simulação em que a criação ocorreu.
  createdSimulationTime: number;
  // Registra a última alteração conhecida.
  updatedAt: string;
}

// Representa a rota calculada para um coletor no estado operacional.
export interface RealtimeRoute {
  // Identifica o coletor responsável pela rota.
  collectorId: string;
  // Ordena recalculações específicas desta rota.
  revision: number;
  // Explica por que a rota foi calculada novamente.
  reason: string;
  // Identifica o destino atual ou usa null quando não existe deslocamento em andamento.
  destinationId: string | null;
  // Lista os pontos habituais incluídos no circuito.
  habitualPointIds: string[];
  // Informa o próximo ponto habitual planejado.
  nextHabitualPointId: string;
  // Transporta a linha GeoJSON que poderá ser desenhada no mapa.
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  // Informa a distância total calculada em metros.
  distanceMeters: number;
  // Informa a duração total estimada em milissegundos.
  durationMs: number;
  // Informa o tempo restante estimado em milissegundos.
  remainingMs: number;
  // Lista as paradas na ordem calculada pelo roteador.
  stops: string[];
}

// Descreve o estado integral entregue após a conexão e nas substituições completas.
export interface RealtimeSnapshot {
  // Identifica a geração atual da simulação.
  generation: number;
  // Identifica a revisão global mais recente aplicada pelo backend.
  revision: number;
  // Informa o relógio virtual da simulação.
  simulationTime: number;
  // Informa o intervalo recomendado para consultas complementares.
  pollIntervalMs: number;
  // Indica se a simulação está pausada.
  paused: boolean;
  // Registra quando o estado foi observado na origem.
  observedAt: string;
  // Lista os pontos que o usuário autenticado pode visualizar.
  points: Point[];
  // Lista os coletores que o usuário autenticado pode acompanhar.
  collectors: Collector[];
  // Lista as rotas permitidas para o papel e os vínculos do usuário.
  routes: RealtimeRoute[];
  // Lista as solicitações permitidas para o papel e os vínculos do usuário.
  requests: RealtimeRequest[];
  // Guarda o cursor externo usado pelo consumidor de eventos.
  eventCursor: string;
  // Registra quando o cache interno terminou sua última atualização.
  updatedAt: string;
}

// Descreve o contrato em português enviado quando o estado de uma solicitação muda.
export interface RealtimeRequestEvent {
  // Identifica a solicitação dentro da plataforma EcoRota.
  idExterno: string;
  // Relaciona a mensagem da EcoRota à solicitação armazenada no PostgreSQL.
  referenciaExterna: string;
  // Identifica o ponto em que o material será coletado.
  pontoColetaExternoId: string;
  // Identifica o coletor atribuído ou usa null antes de uma atribuição.
  coletorExternoId: string | null;
  // Restringe a interface aos cinco estados públicos conhecidos pela aplicação.
  status: 'PENDENTE' | 'ATRIBUIDA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'CANCELADA';
  // Informa quando a mudança foi registrada pela EcoRota.
  ocorridoEm: string;
  // Permite que a tela descarte um evento mais antigo que o estado já exibido.
  revisao: number;
  // Permite que a tela descarte mensagens pertencentes a uma simulação anterior.
  geracao: number;
}

// Posição de um coletor cadastrado na plataforma, enviada pelo app dele (não vem da EcoRota).
export interface LocalCollectorPositionEvent {
  // UUID do usuário coletor.
  coletorId: string;
  nome: string;
  posicao: CollectorPosition;
  precisaoMetros: number | null;
  observadoEm: string;
}

// Descreve os dados usados para mover um coletor no mapa.
export interface RealtimeCollectorPositionEvent {
  // Indica qual marcador do coletor deve ser atualizado.
  coletorExternoId: string;
  // Transporta a posição GeoJSON já validada pelo consumidor do backend.
  posicao: CollectorPosition | null;
  // Indica quando a posição foi medida para calcular se a telemetria está desatualizada.
  observadoEm: string;
  // Permite ordenar atualizações recebidas dentro da mesma geração.
  revisao: number;
  // Identifica a geração da simulação responsável pela posição.
  geracao: number;
}

// Descreve o evento de rota traduzido pelo servidor para o frontend.
export interface RealtimeRouteEvent {
  // Identifica o coletor dono da rota.
  coletorExternoId: string;
  // Contém geometria, paradas, distância e duração calculadas.
  rota: RealtimeRoute;
  // Permite ordenar a atualização no estado global.
  revisao: number;
  // Permite rejeitar uma rota de uma geração anterior.
  geracao: number;
}

// Descreve eventos administrativos exibidos apenas para operadores.
export interface RealtimeOperationEvent {
  // Identifica unicamente a mensagem para facilitar deduplicação futura.
  id: string;
  // Mantém o tipo técnico porque eventos administrativos possuem formatos variados.
  tipo: string;
  // Guarda o conteúdo específico sem obrigar a tela a interpretar dados que não utiliza.
  dados: unknown;
  // Registra quando o evento ocorreu na origem.
  ocorridoEm: string;
  // Informa a revisão global do evento.
  revisao: number;
  // Informa a geração da simulação.
  geracao: number;
}

// Lista todos os eventos que o servidor pode enviar para uma conexão do React.
export interface ServerToClientEvents {
  // Preenche a tela assim que o handshake e a consulta de permissões terminam.
  'operacao:estado-inicial': (snapshot: RealtimeSnapshot) => void;
  // Substitui o estado da tela quando a EcoRota envia um novo snapshot integral.
  'operacao:estado-atualizado': (snapshot: RealtimeSnapshot) => void;
  // Entrega ao operador eventos administrativos de coletor ou simulação.
  'operacao:evento': (event: RealtimeOperationEvent) => void;
  // Avisa que uma solicitação recebeu um coletor.
  'solicitacao:atribuida': (event: RealtimeRequestEvent) => void;
  // Avisa criação, início, cancelamento ou retorno à fila de uma solicitação.
  'solicitacao:status-atualizado': (event: RealtimeRequestEvent) => void;
  // Avisa que uma solicitação foi concluída.
  'solicitacao:concluida': (event: RealtimeRequestEvent) => void;
  // Entrega a posição mais recente de um coletor autorizado.
  'coletor:posicao-atualizada': (event: RealtimeCollectorPositionEvent) => void;
  // Entrega a posição de um coletor da plataforma ao operador e ao morador atendido por ele.
  'coletor-local:posicao': (event: LocalCollectorPositionEvent) => void;
  // Entrega ao coletor ou operador uma rota recalculada pela EcoRota.
  'rota:atualizada': (event: RealtimeRouteEvent) => void;
}

// Cria uma conexão configurada, mas deixa a tela decidir o momento exato de abri-la.
export function createRealtimeClient(
  // Recebe somente uma possível URL alternativa; a identidade segue automaticamente no cookie httpOnly.
  options: RealtimeClientOptions,
): Socket<ServerToClientEvents> {
  // Prioriza a URL informada pela tela, depois o .env do Vite e por fim o servidor local padrão.
  const apiUrl = options.apiUrl ?? (import.meta.env.DEV ? window.location.origin : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000'));
  // Cria o cliente apontando para o namespace lógico /tempo-real.
  return io(`${apiUrl.replace(/\/$/, '')}/tempo-real`, {
    // Usa o mesmo caminho técnico configurado no servidor Socket.IO.
    path: '/socket.io',
    // Evita conectar antes que a tela registre seus listeners para não perder o estado inicial.
    autoConnect: false,
    // Tenta WebSocket primeiro e conserva polling como alternativa em redes que bloqueiam upgrade.
    transports: ['websocket', 'polling'],
    // Envia o cookie httpOnly da sessão no handshake e nas tentativas de reconexão.
    withCredentials: true,
    // Diz à API qual cookie de papel ler; é avaliado a cada conexão, inclusive nas reconexões.
    auth: (callback) => callback({ papel: options.role ?? currentAreaRole() }),
    // Solicita novas tentativas automáticas após quedas temporárias de rede.
    reconnection: true,
    // Aguarda inicialmente um segundo entre tentativas de reconexão.
    reconnectionDelay: 1_000,
    // Limita a espera máxima a trinta segundos para que a recuperação não fique lenta indefinidamente.
    reconnectionDelayMax: 30_000,
  });
}

// Converte as posições dos coletores da plataforma no formato de coletor usado pelo mapa.
export function localCollectorsForMap(positions: Record<string, LocalCollectorPositionEvent>): Collector[] {
  return Object.values(positions).map((event) => ({
    id: `local:${event.coletorId}`,
    name: event.nome,
    origin: 'custom',
    // Só coletores em coleta compartilham posição; disponibilidade real fica no perfil.
    available: false,
    status: 'EM_COLETA',
    circuit: 0,
    position: event.posicao,
    observedAt: event.observadoEm,
  }));
}
