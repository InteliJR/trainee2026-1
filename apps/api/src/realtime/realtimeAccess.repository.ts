// Importa somente o tipo do cliente Prisma, usado para declarar a dependência sem gerar código JavaScript adicional.
import type { PrismaClient } from '../generated/prisma/client.js';
// Importa o tipo dos três papéis persistidos pelo Prisma: MORADOR, COLETOR e OPERADOR.
import type { UserRole } from '../generated/prisma/enums.js';

// Representa a identidade que o Socket.IO pode usar depois de confirmá-la no banco de dados.
export interface RealtimeActor {
  // Guarda o UUID do usuário, que também será usado para formar sua sala particular.
  id: string;
  // Guarda o papel vindo do banco; o servidor nunca aceita um papel informado pelo navegador.
  role: UserRole;
  // Relaciona um usuário coletor ao identificador usado pela plataforma externa EcoRota.
  ecoRotaCollectorId: string | null;
}

// Reúne os usuários locais que podem receber eventos de uma solicitação específica.
export interface RequestRecipients {
  // Identifica o morador proprietário da solicitação.
  residentUserId: string;
  // Identifica o coletor responsável, ou null quando ainda não houve atribuição.
  collectorUserId: string | null;
}

// Define todas as consultas de autorização necessárias ao servidor de tempo real.
export interface RealtimeAccessRepository {
  // Procura e monta a identidade de tempo real a partir do UUID validado no JWT do handshake.
  findActor(userId: string): Promise<RealtimeActor | null>;
  // Lista as referências externas das solicitações que o ator tem permissão para visualizar.
  listAllowedExternalReferences(actor: RealtimeActor): Promise<string[]>;
  // Descobre morador e coletor relacionados a uma solicitação da EcoRota.
  findRequestRecipients(externalReference: string): Promise<RequestRecipients | null>;
  // Converte o identificador externo de um coletor no UUID do usuário local correspondente.
  findCollectorUserId(externalCollectorId: string): Promise<string | null>;
  // Lista moradores com coletas ativas vinculadas a um coletor externo.
  listResidentUserIds(externalCollectorId: string): Promise<string[]>;
}

// Implementa o contrato de autorização usando as tabelas PostgreSQL acessadas pelo Prisma.
export class PrismaRealtimeAccessRepository implements RealtimeAccessRepository {
  // Recebe o cliente Prisma por injeção para permitir uso real no servidor e substituição por fake nos testes.
  constructor(private readonly database: PrismaClient) {}

  // Confirma que o usuário existe e carrega somente os campos usados pelo Socket.IO.
  async findActor(userId: string): Promise<RealtimeActor | null> {
    // Faz uma busca única pela chave primária UUID da tabela de usuários.
    const user = await this.database.user.findUnique({
      // Restringe a consulta ao usuário informado no handshake.
      where: { id: userId },
      // Evita carregar senha, e-mail ou outros dados desnecessários para a conexão em tempo real.
      select: {
        // Carrega o UUID usado para criar a sala particular do usuário.
        id: true,
        // Carrega o papel usado para criar a sala coletiva e decidir o nível de acesso.
        role: true,
        // Carrega apenas o vínculo externo do perfil de coletor, quando esse perfil existir.
        collectorProfile: { select: { ecoRotaCollectorId: true } },
      },
    });
    // Interrompe a autenticação quando nenhum usuário do banco corresponde ao UUID recebido.
    if (!user) return null;
    // Converte o resultado do Prisma para o formato mínimo utilizado pelo módulo de tempo real.
    return {
      // Repassa o UUID confirmado pelo banco.
      id: user.id,
      // Repassa o papel confirmado pelo banco.
      role: user.role,
      // Usa null quando o usuário não possui perfil de coletor ou vínculo com a EcoRota.
      ecoRotaCollectorId: user.collectorProfile?.ecoRotaCollectorId ?? null,
    };
  }

  // Retorna as solicitações que poderão aparecer no snapshot particular do ator.
  async listAllowedExternalReferences(actor: RealtimeActor): Promise<string[]> {
    // O operador pode receber o snapshot completo, portanto não precisa de uma lista de filtro.
    if (actor.role === 'OPERADOR') return [];
    // Consulta somente as solicitações pertencentes ou atribuídas ao usuário conectado.
    const requests = await this.database.collectionRequest.findMany({
      // Para morador filtra pela propriedade; para coletor filtra pelo usuário do perfil associado.
      where: actor.role === 'MORADOR'
        ? { residentId: actor.id }
        : { collectorProfile: { userId: actor.id } },
      // Retorna apenas a referência compartilhada entre nosso banco e a EcoRota.
      select: { externalReference: true },
    });
    // Transforma os registros do Prisma em uma lista simples usada pelo filtro em memória.
    return requests.map((request) => request.externalReference);
  }

  // Localiza os destinatários de um evento usando a referência externa presente na mensagem da EcoRota.
  async findRequestRecipients(externalReference: string): Promise<RequestRecipients | null> {
    // Busca a solicitação pela coluna única externalReference.
    const request = await this.database.collectionRequest.findUnique({
      // Garante que somente a solicitação mencionada no evento será consultada.
      where: { externalReference },
      // Carrega apenas os identificadores necessários para selecionar salas Socket.IO.
      select: {
        // Recupera o proprietário da solicitação.
        residentId: true,
        // Recupera o usuário do coletor local associado, quando houver.
        collectorProfile: { select: { userId: true } },
      },
    });
    // Retorna null quando o evento externo não possui correspondência no domínio local.
    if (!request) return null;
    // Monta um objeto independente do formato retornado pelo Prisma.
    return {
      // Expõe o UUID do morador para a sala usuario:<uuid>.
      residentUserId: request.residentId,
      // Expõe o UUID do coletor ou null para solicitações ainda não atribuídas.
      collectorUserId: request.collectorProfile?.userId ?? null,
    };
  }

  // Resolve quem é o usuário local correspondente a um coletor mencionado pela EcoRota.
  async findCollectorUserId(externalCollectorId: string): Promise<string | null> {
    // Usa a coluna única ecoRotaCollectorId para encontrar o perfil sem ambiguidades.
    const collector = await this.database.collectorProfile.findUnique({
      // Compara o identificador recebido no evento com o vínculo persistido localmente.
      where: { ecoRotaCollectorId: externalCollectorId },
      // Carrega somente o UUID usado na sala particular.
      select: { userId: true },
    });
    // Retorna null quando o coletor externo ainda não foi vinculado a um usuário local.
    return collector?.userId ?? null;
  }

  // Descobre quais moradores podem acompanhar a posição atual de um determinado coletor.
  async listResidentUserIds(externalCollectorId: string): Promise<string[]> {
    // Busca as solicitações ativas relacionadas ao identificador externo do coletor.
    const requests = await this.database.collectionRequest.findMany({
      // Combina o vínculo do coletor com os únicos estados que representam atendimento ativo.
      where: {
        // Restringe os resultados ao coletor cuja posição foi atualizada.
        externalCollectorId,
        // Exclui solicitações pendentes, concluídas e canceladas para não compartilhar posição sem necessidade.
        status: { in: ['ASSIGNED', 'IN_SERVICE'] },
      },
      // Recupera somente os UUIDs dos moradores interessados.
      select: { residentId: true },
      // Evita repetir um morador que possua mais de uma solicitação ativa com o mesmo coletor.
      distinct: ['residentId'],
    });
    // Converte o resultado em UUIDs usados diretamente para montar as salas particulares.
    return requests.map((request) => request.residentId);
  }

}
