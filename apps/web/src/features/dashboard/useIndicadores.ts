/**
 * Hook que busca os KPIs do painel em GET /api/v1/operacao/indicadores.
 * Os indicadores combinam histórico do banco com o estado em memória, então são consultados por HTTP
 * periodicamente e também logo após cada mudança de solicitação recebida pelo Socket.IO.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ROLE_HEADER } from '../../lib/area';

// Espelha o contrato devolvido por OperationService.getIndicators no backend.
export interface OperationIndicators {
  observadoEm: string;
  atualizadoEm: string;
  dadosDesatualizados: boolean;
  geracao: number;
  revisao: number;
  coletasRealizadas: { hoje: number; semanaAtual: number; mesAtual: number };
  tracao: {
    novosMoradores: { hoje: number; semanaAtual: number; mesAtual: number };
    concluidasNoMes: number;
    canceladasNoMes: number;
    taxaConclusaoPercentual: number;
  };
  solicitacoesAtuais: {
    total: number;
    pendentes: number;
    atribuidas: number;
    emAtendimento: number;
    concluidas: number;
    canceladas: number;
  };
  coletores: {
    total: number;
    disponiveis: number;
    indisponiveisOuEmOperacao: number;
    telemetriaDesatualizada: number;
  };
  // Demanda ativa e coletores disponíveis por circuito; saldo negativo indica falta de capacidade.
  demandaPorRegiao: Array<{
    regiao: string;
    circuito: number;
    solicitacoesAtivas: number;
    capacidadeOfertada: number;
    saldoCapacidade: number;
  }>;
}

// Agrupa os dados e o diagnóstico que os cards precisam para se desenhar.
export interface IndicatorsState {
  data: OperationIndicators | null;
  errorMessage: string | null;
  loading: boolean;
  // Refaz a consulta na hora, para o botão "Tentar novamente".
  reload: () => void;
}

// Define os argumentos aceitos pelo hook.
export interface UseIndicadoresOptions {
  // Muda sempre que o painel recebe um evento de solicitação, disparando uma nova consulta.
  refreshKey?: unknown;
  // Permite desligar a consulta enquanto o usuário não está autenticado.
  enabled?: boolean;
  // Intervalo entre consultas periódicas.
  intervalMs?: number;
}

// Usa VITE_API_URL quando definida, como o restante do frontend; senão passa pelo proxy /api do Vite.
const INDICATORS_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/operacao/indicadores`;

// Traduz os códigos de erro esperados em mensagens curtas para o painel.
const ERROR_MESSAGES: Record<string, string> = {
  DADOS_OPERACIONAIS_INDISPONIVEIS: 'Aguardando o primeiro estado da EcoRota para calcular os indicadores.',
  PAPEL_NAO_AUTORIZADO: 'Somente operadores podem ver os indicadores.',
  NAO_AUTENTICADO: 'Entre com um usuário operador para ver os indicadores.',
};

// Consulta os indicadores e mantém o último valor válido mesmo quando uma nova consulta falha.
export function useIndicadores({ refreshKey, enabled = true, intervalMs = 15_000 }: UseIndicadoresOptions): IndicatorsState {
  const [state, setState] = useState<Omit<IndicatorsState, 'reload'>>({ data: null, errorMessage: null, loading: enabled });
  // Muda a cada pedido manual de nova tentativa, o que reinicia a consulta e o intervalo.
  const [retryCount, setRetryCount] = useState(0);
  const reload = useCallback(() => setRetryCount((count) => count + 1), []);
  // Guarda a requisição em andamento para cancelá-la quando outra começar ou a tela desmontar.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    // Busca uma vez; respostas de requisições canceladas são ignoradas.
    const load = async (): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        // Indicadores são do operador: usa o cookie de sessão desse papel.
        const response = await fetch(INDICATORS_URL, {
          credentials: 'include',
          headers: { [ROLE_HEADER]: 'OPERADOR' },
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const code: string | undefined = body?.codigo;
          const message = (code && ERROR_MESSAGES[code]) ?? body?.mensagem ?? `Falha ao carregar indicadores (${response.status}).`;
          setState((current) => ({ ...current, loading: false, errorMessage: message }));
          return;
        }
        setState({ data: body as OperationIndicators, errorMessage: null, loading: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, loading: false, errorMessage: 'Sem conexão com a API para carregar indicadores.' }));
        console.error('Falha ao consultar indicadores', error);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => {
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, refreshKey, retryCount]);

  return { ...state, reload };
}
