// Importa a fábrica que registra rotas, erros e módulos na aplicação Fastify.
import { buildApp } from './app.js';
// Importa as variáveis de ambiente já carregadas e validadas antes do início do servidor.
import { env } from './config/env.js';
// Importa a fábrica do Prisma configurada para a conexão PostgreSQL do Supabase.
import { createPrismaClient } from './infra/database/prisma.js';
// Importa o adaptador HTTP usado para criar e atualizar recursos na plataforma EcoRota.
import { HttpEcoRotaClient } from './integration/http/httpEcoRotaClient.js';
// Importa o cache em memória compartilhado entre WebSocket, endpoints REST e Socket.IO.
import { operationState } from './integration/operation-state/index.js';
// Importa o consumidor da conexão WebSocket mantida pelo backend com a EcoRota.
import { EcoRotaWsConsumer } from './integration/ws/ecoRotaWsConsumer.js';
// Importa o repositório que persiste geração e revisão para acompanhar a sincronização externa.
import { PrismaSystemStateRepository } from './integration/ws/systemState.repository.js';
// Importa o serviço que transforma eventos EcoRota em alterações do domínio local.
import { EcoRotaDomainSynchronizer } from './integration/sync/ecorotaDomainSynchronizer.js';
// Importa o repositório transacional que atualiza solicitações, histórico e pontuação.
import { PrismaEcoRotaRequestSyncRepository } from './integration/sync/ecorotaRequestSync.repository.js';
// Importa o repositório usado pelo endpoint de saúde para verificar o banco.
import { PrismaHealthRepository } from './modules/health/health.repository.js';
// Importa as consultas que resolvem as permissões das conexões Socket.IO.
import { PrismaRealtimeAccessRepository } from './realtime/realtimeAccess.repository.js';
// Importa a fábrica que anexa o Socket.IO ao servidor HTTP do Fastify.
import { createRealtimeBroker } from './realtime/socketServer.js';
import { collectorPositions } from './realtime/collectorPositions.js';
// Importa o mesmo verificador JWT usado para proteger o handshake Socket.IO.
import { AuthTokenService } from './auth/authToken.js';
import { PrismaCollectionPointRepository } from './modules/operation/collectionPoint.repository.js';
import { LocalCollectorSimulation } from './modules/local-simulation/localCollectorSimulation.js';

// Cria uma única instância Prisma reutilizada por todos os módulos durante a execução da API.
const database = createPrismaClient(env.databaseUrl);
// Cria uma única política criptográfica para validar sessões também fora do ciclo de rotas Fastify.
const authTokenService = new AuthTokenService(env.jwtSecret);
const localSimulation = new LocalCollectorSimulation(new PrismaCollectionPointRepository(database));
// Só cria o cliente externo quando URL e chave EcoRota foram configuradas em conjunto.
const ecoRotaClient = env.ecorotaUrl && env.ecorotaKey
  // Configura o adaptador com a URL base e a credencial que deve permanecer somente no backend.
  ? new HttpEcoRotaClient({ baseUrl: env.ecorotaUrl, apiKey: env.ecorotaKey })
  // Mantém a integração desativada no desenvolvimento local sem credenciais.
  : undefined;
// Declara o consumidor antes do buildApp porque o endpoint de saúde consultará seu estado por callback.
let streamConsumer: EcoRotaWsConsumer | undefined;
// Cria o sincronizador que mantém as solicitações locais coerentes com snapshots e eventos externos.
const domainSynchronizer = new EcoRotaDomainSynchronizer(
  // Injeta o repositório Prisma responsável pelas transações de sincronização.
  new PrismaEcoRotaRequestSyncRepository(database),
);
// Monta a aplicação Fastify e registra os módulos REST.
const app = buildApp({
  // Fornece a consulta de saúde que confirma a comunicação com o PostgreSQL.
  healthRepository: new PrismaHealthRepository(database),
  // Fornece o Prisma aos módulos que precisam persistir dados.
  database,
  // Informa o ambiente para configurar corretamente as flags de segurança do cookie.
  nodeEnv: env.nodeEnv,
  // Fornece o segredo usado para emitir e validar os cookies JWT.
  jwtSecret: env.jwtSecret,
  // Autoriza o envio do cookie somente a partir do frontend configurado.
  webOrigin: env.webOrigin,
  // Fornece o cliente EcoRota ou undefined quando a integração está desativada.
  ecoRotaClient,
  localSimulation,
  // Só expõe o estado do stream quando existem credenciais para tentar a conexão externa.
  streamStatusProvider: env.ecorotaUrl && env.ecorotaKey
    // Retorna o estado atual do consumidor ou um estado inicial enquanto ele ainda não foi atribuído.
    ? () => streamConsumer?.getStatus() ?? {
        // Indica que a conexão está sendo preparada.
        connection: 'connecting',
        // Inicia a contagem de tentativas em zero.
        reconnectAttempt: 0,
        // Não há mensagem recebida antes da abertura do stream.
        lastMessageAt: null,
        // Não há erro registrado antes da primeira tentativa.
        lastError: null,
      }
    // Omite a telemetria do stream quando a integração não foi configurada.
    : undefined,
});
// Anexa o Socket.IO ao mesmo servidor HTTP usado pelo Fastify.
const realtimeBroker = createRealtimeBroker(app, {
  // Restringe pelo CORS a origem web autorizada a abrir conexões.
  webOrigin: env.webOrigin,
  // Exige no Socket.IO o cookie JWT criado pelo endpoint de login.
  tokenService: authTokenService,
  // Fornece consultas de usuário, papel, vínculo e destinatários baseadas no Prisma.
  accessRepository: new PrismaRealtimeAccessRepository(database),
  // Compartilha exatamente o mesmo cache atualizado pelo WebSocket da EcoRota.
  state: operationState,
  localSimulation,
  // Repassa as posições enviadas pelo app dos coletores da plataforma.
  collectorPositions,
});
// Cria o consumidor WebSocket somente quando a integração externa possui configuração completa.
streamConsumer = env.ecorotaUrl && env.ecorotaKey
  // Instancia o consumidor responsável por manter uma única conexão externa para toda a API.
  ? new EcoRotaWsConsumer({
      // Usa a mesma URL base empregada pelo cliente HTTP.
      baseUrl: env.ecorotaUrl,
      // Envia a chave somente no handshake backend com a EcoRota.
      apiKey: env.ecorotaKey,
      // Faz snapshots e eventos atualizarem o cache observado pelo Socket.IO.
      operationState,
      // Persiste geração e revisão para diagnóstico e retomada segura.
      systemStateRepository: new PrismaSystemStateRepository(database),
      // Reutiliza o logger estruturado do Fastify.
      logger: app.log,
      // Reconcilia todas as solicitações quando um snapshot integral chega.
      onSnapshot: async (snapshot) => {
        // Atualiza o domínio local e coleta as quantidades de cada resultado da sincronização.
        const summary = await domainSynchronizer.synchronizeSnapshot(snapshot);
        // Registra o resumo sem expor o conteúdo completo das solicitações.
        app.log.info({ summary }, 'Snapshot EcoRota reconciliado com o domínio local.');
      },
      // Reconcilia somente a alteração correspondente quando chega um evento incremental.
      onEvent: async (event) => {
        // Aplica a mensagem ao domínio local com proteção contra duplicidade.
        const result = await domainSynchronizer.synchronizeEvent(event);
        // Evita gerar log de sincronização para eventos que não alteram solicitações locais.
        if (result !== 'ignored') {
          // Registra identificador, tipo e resultado para rastrear a atualização sem dados pessoais.
          app.log.info({ eventId: event.id, type: event.type, result }, 'Evento EcoRota sincronizado com o domínio local.');
        }
      },
    })
  // Mantém o consumidor ausente quando URL ou chave não foram configuradas.
  : undefined;

// Registra a ordem de encerramento executada quando o Fastify recebe shutdown.
app.addHook('onClose', async () => {
  localSimulation.close();
  // Remove listeners e encerra os clientes Socket.IO antes de fechar o servidor HTTP.
  await realtimeBroker.close();
  // Interrompe reconexões e aguarda o processamento pendente do WebSocket externo.
  await streamConsumer?.stop();
  // Libera as conexões mantidas pelo Prisma com o PostgreSQL.
  await database.$disconnect();
});

// Coordena a conexão das dependências e a abertura da porta HTTP.
async function start(): Promise<void> {
  // Captura falhas de banco, stream ou porta para encerrar a aplicação de forma previsível.
  try {
    // Confirma a conexão com o banco antes de aceitar requisições ou handshakes.
    await database.$connect();
    // Inicia o WebSocket externo sem bloquear a subida da API enquanto aguarda mensagens.
    streamConsumer?.start();
    // Escuta em todas as interfaces de rede na porta validada do ambiente.
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (error) {
    // Registra a causa original para diagnóstico do processo que não conseguiu iniciar.
    app.log.error({ err: error }, 'Não foi possível iniciar a API');
    // Executa os hooks de encerramento mesmo quando a inicialização falha parcialmente.
    await app.close();
    // Sinaliza falha ao sistema operacional sem forçar a interrupção antes do cleanup.
    process.exitCode = 1;
  }
}

// Aguarda a inicialização no módulo principal para manter erros dentro do fluxo controlado acima.
await start();
