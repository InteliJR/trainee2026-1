// Importa o Fastify para criar um servidor HTTP real e isolado durante cada teste de conexão.
import Fastify, { type FastifyInstance } from 'fastify';
// Importa o cliente Socket.IO usado para simular um navegador conectando à API.
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
// Importa as funções do Vitest que organizam casos, verificações e limpeza após cada execução.
import { afterEach, describe, expect, it } from 'vitest';
// Importa o contrato do snapshot externo usado para preparar o cache de teste.
import type { EcoRotaSnapshot } from '../src/integration/ecorotaClient.js';
// Importa uma instância isolável do cache operacional para não reutilizar estado entre testes.
import { OperationStateStore } from '../src/integration/operation-state/operationState.js';
// Importa os contratos implementados pelo repositório fake de autorização.
import type {
  // Define os métodos que o fake precisa oferecer ao servidor.
  RealtimeAccessRepository,
  // Define a identidade que o fake retornará para cada UUID conhecido.
  RealtimeActor,
  // Define morador e coletor retornados por uma solicitação conhecida.
  RequestRecipients,
} from '../src/realtime/realtimeAccess.repository.js';
// Importa o servidor, o filtro puro e o contrato usado no encerramento dos testes.
import {
  // Cria a integração Socket.IO anexada ao Fastify de teste.
  createRealtimeBroker,
  // Permite verificar a regra de privacidade sem abrir uma conexão de rede.
  filterSnapshotForActor,
  // Tipifica a variável que guarda o broker criado em cada teste.
  type RealtimeBroker,
} from '../src/realtime/socketServer.js';
// Importa a autenticação real usada também no handshake de produção.
import { AuthTokenService, SESSION_COOKIE_NAME } from '../src/auth/authToken.js';

// Usa um UUID válido e estável para representar o morador autorizado nos testes.
const RESIDENT_ID = '11111111-1111-4111-8111-111111111111';
// Usa outro UUID válido para representar um morador que não deve compartilhar dados com o primeiro.
const OTHER_RESIDENT_ID = '22222222-2222-4222-8222-222222222222';
// Usa um segredo longo e exclusivo da suíte para assinar tokens descartáveis.
const TEST_JWT_SECRET = 'segredo-exclusivo-dos-testes-socket-io-com-mais-de-32-caracteres';
// Compartilha o emissor/verificador real entre servidor e clientes simulados.
const tokenService = new AuthTokenService(TEST_JWT_SECRET);

// Substitui o Prisma por respostas determinísticas para testar somente as regras do Socket.IO.
class FakeAccessRepository implements RealtimeAccessRepository {
  // Relaciona UUIDs conhecidos às identidades que seriam carregadas do PostgreSQL.
  readonly actors = new Map<string, RealtimeActor>([
    // Cadastra o primeiro morador sem vínculo de coletor.
    [RESIDENT_ID, { id: RESIDENT_ID, role: 'MORADOR', ecoRotaCollectorId: null }],
    // Cadastra o segundo morador para validar o isolamento entre usuários.
    [OTHER_RESIDENT_ID, { id: OTHER_RESIDENT_ID, role: 'MORADOR', ecoRotaCollectorId: null }],
  ]);

  // Simula a busca de identidade executada durante o handshake.
  findActor(userId: string): Promise<RealtimeActor | null> {
    // Retorna o ator conhecido ou null da mesma forma que o repositório Prisma.
    return Promise.resolve(this.actors.get(userId) ?? null);
  }

  // Simula as referências externas que cada morador pode visualizar.
  listAllowedExternalReferences(actor: RealtimeActor): Promise<string[]> {
    // Dá ao primeiro morador apenas seu pedido e ao segundo apenas o outro pedido.
    return Promise.resolve(actor.id === RESIDENT_ID ? ['pedido-do-morador'] : ['pedido-de-outro']);
  }

  // Simula a resolução dos destinatários de um evento de solicitação.
  findRequestRecipients(externalReference: string): Promise<RequestRecipients | null> {
    // Reconhece somente o pedido usado pelo primeiro morador neste cenário.
    return Promise.resolve(externalReference === 'pedido-do-morador'
      // Vincula o pedido ao morador e mantém o coletor ausente.
      ? { residentUserId: RESIDENT_ID, collectorUserId: null }
      // Retorna null para referências que não fazem parte do cenário.
      : null);
  }

  // Simula que nenhum coletor externo possui usuário local vinculado neste teste.
  findCollectorUserId(): Promise<string | null> {
    // Resolve imediatamente com null para manter o cenário focado no morador.
    return Promise.resolve(null);
  }

  // Simula que nenhum outro morador acompanha a posição de um coletor neste teste.
  listResidentUserIds(): Promise<string[]> {
    // Resolve com lista vazia porque os casos não testam telemetria de coletor.
    return Promise.resolve([]);
  }
}

// Monta um snapshot com duas solicitações pertencentes a moradores diferentes.
function createSnapshot(): EcoRotaSnapshot {
  // Retorna todos os campos exigidos pelo contrato da EcoRota.
  return {
    // Identifica o ambiente externo simulado.
    id: 'environment',
    // Dá um nome legível ao ambiente de teste.
    name: 'Teste',
    // Define a primeira geração da simulação.
    generation: 1,
    // Define a revisão inicial do snapshot.
    revision: 1,
    // Define o relógio lógico inicial da simulação.
    simulationTime: 1,
    // Mantém a simulação ativa.
    paused: false,
    // Registra um horário fixo para tornar o teste determinístico.
    observedAt: '2026-09-24T10:00:00.000Z',
    // Informa a capacidade de coletores do ambiente simulado.
    maxCollectors: 4,
    // Informa que nenhum coletor está ocupando um slot.
    occupiedSlots: 0,
    // Define o intervalo lógico de atualização da simulação.
    tickMs: 1_000,
    // Define o intervalo recomendado para consultas de fallback.
    pollIntervalMs: 5_000,
    // Mantém os pontos vazios porque o teste valida apenas privacidade de solicitações.
    points: [],
    // Mantém os coletores vazios porque o teste não depende do mapa.
    collectors: [],
    // Mantém as rotas vazias porque o ator do cenário é morador.
    routes: [],
    // Inclui dois pedidos para comprovar que apenas um deles atravessa o filtro.
    requests: [
      {
        // Identifica o primeiro pedido na EcoRota.
        id: 'request-1',
        // Relaciona o primeiro pedido a um ponto simulado.
        pointId: 'point-1',
        // Relaciona o primeiro pedido ao morador autorizado.
        externalReference: 'pedido-do-morador',
        // Mantém o pedido aguardando atendimento.
        status: 'pending',
        // Indica que ainda não existe coletor atribuído.
        collectorId: null,
        // Registra a criação em um horário fixo.
        createdAt: '2026-09-24T10:00:00.000Z',
        // Registra o relógio lógico em que o pedido foi criado.
        createdSimulationTime: 1,
        // Registra a última alteração em um horário fixo.
        updatedAt: '2026-09-24T10:00:00.000Z',
      },
      {
        // Identifica o pedido que não deve ser visto pelo primeiro morador.
        id: 'request-2',
        // Relaciona o segundo pedido a outro ponto.
        pointId: 'point-2',
        // Relaciona o segundo pedido a outro morador.
        externalReference: 'pedido-de-outro',
        // Mantém também o segundo pedido aguardando atendimento.
        status: 'pending',
        // Indica que o segundo pedido também não tem coletor.
        collectorId: null,
        // Registra a criação em um horário fixo.
        createdAt: '2026-09-24T10:00:00.000Z',
        // Registra o relógio lógico inicial.
        createdSimulationTime: 1,
        // Registra a última alteração em um horário fixo.
        updatedAt: '2026-09-24T10:00:00.000Z',
      },
    ],
    // Define o cursor correspondente à revisão inicial.
    eventCursor: '1',
  };
}

// Converte um evento do cliente Socket.IO em Promise para permitir uso legível com await.
function waitForEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  // Cria uma Promise resolvida quando o evento esperado chegar.
  return new Promise((resolve, reject) => {
    // Rejeita o teste após dois segundos para que uma emissão ausente não deixe a suíte travada.
    const timeout = setTimeout(() => reject(new Error(`Tempo excedido aguardando ${event}.`)), 2_000);
    // Registra um listener de uso único para impedir que eventos posteriores resolvam a mesma espera.
    socket.once(event, (payload: T) => {
      // Cancela o timeout porque o evento esperado chegou dentro do prazo.
      clearTimeout(timeout);
      // Entrega o conteúdo tipado para as verificações do teste.
      resolve(payload);
    });
  });
}

// Agrupa os testes relacionados ao handshake, à privacidade e à entrega de eventos.
describe('servidor Socket.IO', () => {
  // Guarda o Fastify criado pelo caso atual para encerrá-lo depois do teste.
  let app: FastifyInstance | undefined;
  // Guarda o broker criado pelo caso atual para remover listeners e conexões.
  let broker: RealtimeBroker | undefined;
  // Guarda o cliente que simula o navegador no caso atual.
  let client: ClientSocket | undefined;

  // Executa a limpeza mesmo quando uma expectativa do teste falha.
  afterEach(async () => {
    // Fecha a conexão do navegador simulado.
    client?.close();
    // Remove o listener do cache e encerra os transportes do Socket.IO.
    await broker?.close();
    // Fecha a porta HTTP aberta pelo Fastify.
    await app?.close();
  });

  // Verifica diretamente a função pura responsável por proteger o conteúdo do snapshot.
  it('filtra solicitações e rotas do snapshot conforme o ator', () => {
    // Cria um cache exclusivo para este caso.
    const state = new OperationStateStore();
    // Preenche o cache com os dois pedidos simulados.
    state.replaceSnapshot(createSnapshot());
    // Filtra o estado como se o primeiro morador tivesse acabado de conectar.
    const filtered = filterSnapshotForActor(
      // Fornece a cópia atual do cache.
      state.getSnapshot(),
      // Fornece a identidade confirmada do primeiro morador.
      { id: RESIDENT_ID, role: 'MORADOR', ecoRotaCollectorId: null },
      // Autoriza explicitamente somente a referência pertencente a ele.
      new Set(['pedido-do-morador']),
    );

    // Confirma que o pedido do outro morador não aparece no resultado.
    expect(filtered.requests.map((request) => request.externalReference)).toEqual(['pedido-do-morador']);
    // Confirma que moradores não recebem rotas operacionais de coletores.
    expect(filtered.routes).toEqual([]);
  });

  // Verifica uma conexão de rede real, o estado inicial filtrado e um evento incremental traduzido.
  it('abre a conexão autenticada e envia somente o estado permitido ao morador', async () => {
    // Cria o cache exclusivo deste teste de integração.
    const state = new OperationStateStore();
    // Preenche o cache antes da conexão para testar o estado inicial imediato.
    state.replaceSnapshot(createSnapshot());
    // Cria um servidor Fastify sem logs para manter a saída de teste limpa.
    app = Fastify({ logger: false });
    // Anexa o Socket.IO ao servidor de teste.
    broker = createRealtimeBroker(app, {
      // Configura uma origem permitida equivalente ao frontend local.
      webOrigin: 'http://localhost:5173',
      // Valida o cookie exatamente como o servidor real.
      tokenService,
      // Injeta respostas controladas no lugar do banco real.
      accessRepository: new FakeAccessRepository(),
      // Injeta o cache preparado especificamente para este caso.
      state,
    });
    // Abre uma porta livre escolhida pelo sistema operacional somente durante o teste.
    await app.listen({ host: '127.0.0.1', port: 0 });
    // Lê o endereço efetivamente escolhido pelo servidor.
    const address = app.server.address();
    // Interrompe com mensagem clara se o servidor não forneceu um endereço TCP válido.
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');

    // Emite a sessão que seria criada pelo endpoint POST /autenticacao/entrar.
    const sessionToken = await tokenService.issue({ id: RESIDENT_ID, role: 'MORADOR' });
    // Cria o cliente que simula o navegador do primeiro morador.
    client = createSocketClient(`http://127.0.0.1:${address.port}/tempo-real`, {
      // Usa o mesmo caminho técnico configurado no backend.
      path: '/socket.io',
      // Envia o cookie no handshake HTTP sem expor UUID no objeto auth do Socket.IO.
      extraHeaders: { Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
      // Força WebSocket para testar diretamente o transporte principal.
      transports: ['websocket'],
      // Evita reaproveitar uma conexão de outro teste.
      forceNew: true,
    });
    // Aguarda o snapshot enviado automaticamente depois do handshake.
    const snapshot = await waitForEvent<{ requests: Array<{ externalReference: string }> }>(
      // Observa o cliente recém-conectado.
      client,
      // Aguarda exatamente o evento público de estado inicial.
      'operacao:estado-inicial',
    );

    // Confirma pela conexão real que apenas a solicitação autorizada foi entregue.
    expect(snapshot.requests.map((request) => request.externalReference)).toEqual(['pedido-do-morador']);

    // Começa a aguardar a atribuição antes de alterar o cache para não perder uma emissão rápida.
    const assignmentPromise = waitForEvent<{ referenciaExterna: string; status: string }>(
      // Observa a mesma conexão autenticada.
      client,
      // Aguarda o nome específico usado para atribuições.
      'solicitacao:atribuida',
    );
    // Simula a chegada de um evento incremental pelo WebSocket da EcoRota.
    state.applyEvent({
      // Define um identificador ainda não processado pelo cache.
      id: 'event-2',
      // Informa que o evento representa uma atribuição.
      type: 'request.assigned',
      // Mantém a mesma geração do snapshot inicial.
      generation: 1,
      // Avança a revisão para que o cache aceite a mensagem.
      revision: 2,
      // Avança o relógio lógico da simulação.
      simulationTime: 2,
      // Registra quando a atribuição ocorreu.
      occurredAt: '2026-09-24T10:01:00.000Z',
      // Monta a nova versão da solicitação.
      data: {
        // Reaproveita os campos estáveis do primeiro pedido.
        ...createSnapshot().requests[0],
        // Altera o estado para atribuído.
        status: 'assigned',
        // Associa um coletor externo ao pedido.
        collectorId: 'collector-1',
      },
    });
    // Confirma que o morador recebeu a referência correta e o status traduzido para português.
    await expect(assignmentPromise).resolves.toMatchObject({
      // Verifica que o evento pertence à solicitação autorizada.
      referenciaExterna: 'pedido-do-morador',
      // Verifica a tradução aplicada pelo servidor.
      status: 'ATRIBUIDA',
    });
  });

  // Verifica que possuir um UUID bem formado não basta quando o usuário não existe no banco.
  it('recusa uma identidade que não existe', async () => {
    // Cria um novo servidor isolado para o cenário de rejeição.
    app = Fastify({ logger: false });
    // Anexa o broker usando o mesmo repositório fake dos demais testes.
    broker = createRealtimeBroker(app, {
      // Configura a origem permitida do frontend local.
      webOrigin: 'http://localhost:5173',
      // Valida o mesmo formato JWT usado no primeiro cenário.
      tokenService,
      // Injeta o fake que conhece somente os dois UUIDs declarados no início do arquivo.
      accessRepository: new FakeAccessRepository(),
      // Usa um cache vazio porque a conexão será recusada antes do estado inicial.
      state: new OperationStateStore(),
    });
    // Abre uma porta livre para realizar o handshake real.
    await app.listen({ host: '127.0.0.1', port: 0 });
    // Recupera a porta escolhida pelo sistema operacional.
    const address = app.server.address();
    // Garante que o servidor retornou um endereço TCP utilizável.
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');

    // Emite um token válido para um UUID que o repositório fake não reconhece.
    const unknownSessionToken = await tokenService.issue({
      id: '33333333-3333-4333-8333-333333333333',
      role: 'MORADOR',
    });
    // Tenta conectar usando a sessão válida de um usuário removido ou inexistente.
    client = createSocketClient(`http://127.0.0.1:${address.port}/tempo-real`, {
      // Usa o caminho técnico configurado no servidor.
      path: '/socket.io',
      // Envia o cookie real para que a rejeição aconteça somente na confirmação do banco.
      extraHeaders: { Cookie: `${SESSION_COOKIE_NAME}=${unknownSessionToken}` },
      // Usa diretamente o transporte WebSocket.
      transports: ['websocket'],
      // Impede compartilhamento de conexão com outros casos.
      forceNew: true,
    });
    // Aguarda o erro de handshake devolvido pelo middleware do namespace.
    const error = await waitForEvent<Error>(client, 'connect_error');

    // Confirma que o servidor invalidou a sessão cuja identidade não existe mais.
    expect(error.message).toBe('SESSAO_DESATUALIZADA');
  });
});
