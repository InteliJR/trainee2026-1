/**
 * Hook que conecta o ciclo de vida do React ao Socket.IO e mantém uma cópia consistente do estado operacional.
 * O reducer separado permite testar ordenação, posição, solicitações e rotas sem abrir uma conexão de rede.
 */
import { useEffect, useReducer } from 'react';
import {
  createRealtimeClient,
  type RealtimeCollectorPositionEvent,
  type RealtimeRequestEvent,
  type RealtimeRequestStatus,
  type RealtimeRouteEvent,
  type RealtimeSnapshot,
} from './socketClient';

// Enumera os estados visuais possíveis da conexão no painel.
export type RealtimeConnectionStatus = 'conectando' | 'conectado' | 'reconectando' | 'desconectado' | 'erro';

// Agrupa os dados que o componente consome e as informações de diagnóstico da conexão.
export interface RealtimeState {
  // Informa o estado atual do transporte Socket.IO.
  connectionStatus: RealtimeConnectionStatus;
  // Guarda o último snapshot e os deltas aceitos pelo reducer.
  snapshot: RealtimeSnapshot | null;
  // Guarda uma mensagem segura para orientar o usuário quando o handshake falhar.
  errorMessage: string | null;
  // Guarda o último evento de solicitação para permitir feedback visual posterior.
  lastRequestEvent: RealtimeRequestEvent | null;
}

// Descreve os argumentos públicos aceitos pelo hook.
export interface UseTempoRealOptions {
  // Permite desativar a conexão em páginas públicas como cadastro e login.
  enabled?: boolean;
  // Permite apontar o hook para uma API alternativa em previews e testes manuais.
  apiUrl?: string;
}

// Lista todas as transições que podem alterar o estado do hook.
export type RealtimeAction =
  | { type: 'conexao'; status: RealtimeConnectionStatus }
  | { type: 'erro'; message: string }
  | { type: 'snapshot'; snapshot: RealtimeSnapshot }
  | { type: 'posicao-coletor'; event: RealtimeCollectorPositionEvent }
  | { type: 'solicitacao'; event: RealtimeRequestEvent }
  | { type: 'rota'; event: RealtimeRouteEvent };

// Define o estado exibido antes que o primeiro handshake seja iniciado.
export const INITIAL_REALTIME_STATE: RealtimeState = {
  connectionStatus: 'desconectado',
  snapshot: null,
  errorMessage: null,
  lastRequestEvent: null,
};

// Traduz o status público em português para o status técnico armazenado no snapshot.
const REQUEST_STATUS_BY_PUBLIC_STATUS: Record<RealtimeRequestEvent['status'], RealtimeRequestStatus> = {
  PENDENTE: 'pending',
  ATRIBUIDA: 'assigned',
  EM_ATENDIMENTO: 'in_service',
  CONCLUIDA: 'completed',
  CANCELADA: 'cancelled',
};

// Centraliza as transições para manter a ordem de geração e revisão igual em todos os eventos.
export function realtimeReducer(state: RealtimeState, action: RealtimeAction): RealtimeState {
  // Atualiza somente o indicador visual quando o transporte muda de estado.
  if (action.type === 'conexao') {
    return {
      ...state,
      connectionStatus: action.status,
      errorMessage: action.status === 'conectado' ? null : state.errorMessage,
    };
  }

  // Registra falhas do handshake ou transporte sem apagar o último mapa válido.
  if (action.type === 'erro') {
    return { ...state, connectionStatus: 'erro', errorMessage: action.message };
  }

  // Aceita um estado integral somente quando ele não é mais antigo que o já exibido.
  if (action.type === 'snapshot') {
    // Mantém o estado atual quando o servidor envia uma geração ou revisão já ultrapassada.
    if (!shouldAcceptSnapshot(state.snapshot, action.snapshot)) return state;
    // Substitui as coleções integralmente e preserva o último evento usado para feedback visual.
    return { ...state, snapshot: action.snapshot };
  }

  // Eventos incrementais dependem de um snapshot da mesma geração para terem uma base consistente.
  if (!state.snapshot || !shouldAcceptIncrement(state.snapshot, action)) return state;

  // Move apenas o coletor citado, sem reconstruir pontos, solicitações ou rotas.
  if (action.type === 'posicao-coletor') {
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        revision: Math.max(state.snapshot.revision, action.event.revisao),
        observedAt: action.event.observadoEm,
        updatedAt: new Date().toISOString(),
        collectors: state.snapshot.collectors.map((collector) => collector.id === action.event.coletorExternoId
          // Atualiza posição e horário somente no marcador correspondente.
          ? { ...collector, position: action.event.posicao, observedAt: action.event.observadoEm }
          // Reutiliza os demais coletores sem alteração.
          : collector),
      },
    };
  }

  // Atualiza a solicitação visível pelo vínculo externo e guarda o evento para feedback da interface.
  if (action.type === 'solicitacao') {
    const { event } = action;
    const status = REQUEST_STATUS_BY_PUBLIC_STATUS[event.status];
    const exists = state.snapshot.requests.some((request) => request.externalReference === event.referenciaExterna);
    return {
      ...state,
      lastRequestEvent: event,
      snapshot: {
        ...state.snapshot,
        revision: Math.max(state.snapshot.revision, event.revisao),
        observedAt: event.ocorridoEm,
        updatedAt: new Date().toISOString(),
        requests: exists
          ? state.snapshot.requests.map((request) => request.externalReference === event.referenciaExterna
            // Aplica status, coletor e horário traduzidos pelo contrato público.
            ? { ...request, status, collectorId: event.coletorExternoId, updatedAt: event.ocorridoEm }
            // Preserva solicitações que não pertencem ao evento recebido.
            : request)
          // Uma solicitação criada depois do snapshot só chega por evento; sem este acréscimo ela sumiria da tela.
          : [...state.snapshot.requests, {
            id: event.idExterno,
            pointId: event.pontoColetaExternoId,
            externalReference: event.referenciaExterna,
            status,
            collectorId: event.coletorExternoId,
            createdAt: event.ocorridoEm,
            // O evento público não traz o relógio da simulação; o próximo snapshot integral corrige o valor.
            createdSimulationTime: state.snapshot.simulationTime,
            updatedAt: event.ocorridoEm,
          }],
      },
    };
  }

  // Substitui ou acrescenta a rota do coletor que recebeu um novo cálculo.
  if (action.type === 'rota') {
    // Retira a versão antiga para garantir uma única rota por coletor.
    const otherRoutes = state.snapshot.routes.filter((route) => route.collectorId !== action.event.coletorExternoId);
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        revision: Math.max(state.snapshot.revision, action.event.revisao),
        updatedAt: new Date().toISOString(),
        routes: [...otherRoutes, action.event.rota],
      },
    };
  }

  // O tipo discriminado torna este retorno inalcançável, mas ele mantém a função total em tempo de execução.
  return state;
}

// Compara versões de snapshots integrais e rejeita dados antigos após reconexões.
export function shouldAcceptSnapshot(current: RealtimeSnapshot | null, incoming: RealtimeSnapshot): boolean {
  // O primeiro snapshot sempre é necessário para preencher a tela.
  if (!current) return true;
  // Uma geração maior representa uma nova execução e substitui qualquer estado anterior.
  if (incoming.generation > current.generation) return true;
  // Uma geração menor pertence a uma execução encerrada e deve ser descartada.
  if (incoming.generation < current.generation) return false;
  // Dentro da mesma geração, aceita revisão igual ou maior para permitir uma reconciliação integral.
  return incoming.revision >= current.revision;
}

// Verifica se um delta pode ser aplicado sobre o snapshot atualmente exibido.
function shouldAcceptIncrement(snapshot: RealtimeSnapshot, action: RealtimeAction): boolean {
  // Ações sem metadados de versão já foram tratadas antes desta função.
  if (action.type === 'conexao' || action.type === 'erro' || action.type === 'snapshot') return false;
  // Um delta só é seguro quando pertence exatamente à geração usada como base.
  if (action.event.geracao !== snapshot.generation) return false;
  // Revisões menores já foram incorporadas ao estado e não devem sobrescrever dados recentes.
  return action.event.revisao >= snapshot.revision;
}

// Traduz códigos técnicos do handshake em mensagens compreensíveis na interface.
function explainConnectionError(message: string): string {
  // Mapeia os códigos deliberadamente enviados pelo backend para orientações objetivas.
  const messages: Record<string, string> = {
    SESSAO_NAO_AUTENTICADA: 'Entre na sua conta para acompanhar as atualizações em tempo real.',
    SESSAO_INVALIDA: 'Sua sessão expirou ou é inválida. Entre novamente.',
    SESSAO_DESATUALIZADA: 'Seu usuário ou papel mudou. Entre novamente para atualizar a sessão.',
    FALHA_AO_VALIDAR_IDENTIDADE: 'A API não conseguiu validar o usuário no banco de dados.',
  };
  // Usa uma mensagem genérica somente para erros de rede ou códigos ainda desconhecidos.
  return messages[message] ?? `Não foi possível conectar ao tempo real: ${message}`;
}

// Abre a conexão, registra listeners antes do handshake e remove tudo ao desmontar a tela.
export function useTempoReal(options: UseTempoRealOptions): RealtimeState {
  // O reducer garante que snapshots e deltas atravessem a mesma regra de ordenação.
  const [state, dispatch] = useReducer(realtimeReducer, INITIAL_REALTIME_STATE);

  // Reconstrói a conexão somente quando URL ou habilitação mudarem; o cookie é enviado automaticamente.
  useEffect(() => {
    // Mantém a tela desconectada somente quando o chamador desativou explicitamente o tempo real.
    if (options.enabled === false) {
      dispatch({ type: 'conexao', status: 'desconectado' });
      return undefined;
    }

    // Cria o socket sem conectar para que nenhum evento inicial seja perdido.
    const socket = createRealtimeClient({ apiUrl: options.apiUrl });
    // Exibe imediatamente que o navegador iniciou o handshake.
    dispatch({ type: 'conexao', status: 'conectando' });

    // Marca a conexão como pronta quando o servidor conclui autenticação e upgrade do transporte.
    const handleConnect = (): void => dispatch({ type: 'conexao', status: 'conectado' });
    // Diferencia uma queda recuperável de um encerramento deliberado feito pelo próprio componente.
    const handleDisconnect = (reason: string): void => dispatch({
      type: 'conexao',
      status: reason === 'io client disconnect' ? 'desconectado' : 'reconectando',
    });
    // Expõe uma explicação segura quando o handshake ou uma tentativa de rede falha.
    const handleConnectError = (error: Error): void => dispatch({ type: 'erro', message: explainConnectionError(error.message) });
    // Informa visualmente cada ciclo automático de reconexão iniciado pelo Manager do Socket.IO.
    const handleReconnectAttempt = (): void => dispatch({ type: 'conexao', status: 'reconectando' });
    // Encaminha snapshots integrais para a regra de ordenação do reducer.
    const handleSnapshot = (snapshot: RealtimeSnapshot): void => dispatch({ type: 'snapshot', snapshot });
    // Encaminha posições sem acoplar o transporte à camada do mapa.
    const handleCollectorPosition = (event: RealtimeCollectorPositionEvent): void => dispatch({ type: 'posicao-coletor', event });
    // Encaminha qualquer mudança pública de solicitação para a mesma transição do reducer.
    const handleRequest = (event: RealtimeRequestEvent): void => dispatch({ type: 'solicitacao', event });
    // Encaminha a rota recalculada para substituição por coletor.
    const handleRoute = (event: RealtimeRouteEvent): void => dispatch({ type: 'rota', event });

    // Registra todos os listeners do namespace antes de chamar connect.
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('operacao:estado-inicial', handleSnapshot);
    socket.on('operacao:estado-atualizado', handleSnapshot);
    socket.on('coletor:posicao-atualizada', handleCollectorPosition);
    socket.on('solicitacao:atribuida', handleRequest);
    socket.on('solicitacao:status-atualizado', handleRequest);
    socket.on('solicitacao:concluida', handleRequest);
    socket.on('rota:atualizada', handleRoute);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    // Abre o transporte somente depois que os handlers estão prontos.
    socket.connect();

    // Remove listeners e encerra o transporte para evitar conexões duplicadas em remontagens do React.
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('operacao:estado-inicial', handleSnapshot);
      socket.off('operacao:estado-atualizado', handleSnapshot);
      socket.off('coletor:posicao-atualizada', handleCollectorPosition);
      socket.off('solicitacao:atribuida', handleRequest);
      socket.off('solicitacao:status-atualizado', handleRequest);
      socket.off('solicitacao:concluida', handleRequest);
      socket.off('rota:atualizada', handleRoute);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.disconnect();
    };
  }, [options.apiUrl, options.enabled]);

  // Entrega um único objeto para que a tela leia conexão e dados de forma atômica.
  return state;
}
