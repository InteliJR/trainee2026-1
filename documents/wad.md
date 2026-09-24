# WAD - Modelagem de dados do EcoRota

## 1. Objetivo

Este documento define a modelagem de dados do MVP EcoRota, com base no case técnico, nos requisitos funcionais, no plano de implementação e nas decisões arquiteturais do projeto.

O modelo cobre os dados que pertencem à aplicação:

- cadastro e autenticação de usuários;
- endereços dos moradores;
- vínculo entre usuários coletores e coletores `custom` da EcoRota;
- solicitações de coleta e materiais;
- histórico de alterações de status;
- pontos concedidos após uma coleta concluída;
- controle de sincronização com a API EcoRota.

## 2. Limite da modelagem

A aplicação utiliza PostgreSQL hospedado no Supabase e Prisma ORM. O Supabase é responsável por hospedar o banco; o Prisma representa os modelos, relacionamentos e migrations utilizados pelo backend Fastify.

```text
Frontend React -> API Fastify -> Prisma -> PostgreSQL Supabase
                                  |
                                  +-> API e WebSocket EcoRota
```

### 2.1 Dados persistidos pela aplicação

São persistidos os dados que a EcoRota não fornece ou que precisam de histórico próprio:

- usuários e papéis;
- endereços;
- perfil do coletor da aplicação;
- associação entre pedido local e pedido externo;
- materiais informados pelo morador;
- histórico de status;
- gamificação;
- checkpoint de sincronização.

### 2.2 Dados não persistidos como entidades próprias neste MVP

Os seguintes dados pertencem à plataforma EcoRota e serão mantidos no `OperationState` em memória:

- pontos de coleta;
- coletores automáticos do tipo `system`;
- posição atual dos coletores;
- rotas dinâmicas;
- telemetria operacional.

Quando necessário, seus identificadores externos serão armazenados em `CollectionRequest` e `CollectorProfile`. Essa decisão evita duplicar no Supabase dados cujo sistema de origem é a EcoRota.

### 2.3 Stack definitiva do MVP

As tecnologias abaixo são decisões definitivas para o MVP e devem orientar a implementação e a documentação. Alternativas anteriores deixam de fazer parte da arquitetura-alvo.

| Camada | Decisão definitiva | Observação |
|---|---|---|
| Linguagem | Node.js com TypeScript | Mesma linguagem no backend, frontend e pacote compartilhado. |
| Backend | Fastify | Express não será utilizado. |
| Banco de dados | PostgreSQL hospedado no Supabase | O Supabase será usado como banco gerenciado; o banco não será executado com Docker. |
| ORM e migrations | Prisma ORM | O Prisma define os modelos, relacionamentos, cliente tipado e migrations. |
| Autenticação | JWT criado pelo Fastify e armazenado em cookie `httpOnly` | Supabase Auth não será utilizado no MVP. |
| Frontend | React com Vite | Aplicação web responsiva para morador, coletor e operador. |
| Mapa | MapLibre GL JS | Google Maps não faz parte da arquitetura-alvo. |
| Tempo real externo | WebSocket da EcoRota consumido pelo backend | A credencial externa nunca é enviada ao navegador. |
| Tempo real interno | Socket.IO entre Fastify e React | Eventos enviados somente para usuários e salas autorizadas. |
| Arquitetura | Monólito modular em camadas | Rotas, serviços, repositórios e adaptadores de integração. |

## 3. Entidades escolhidas

| Entidade | Responsabilidade | Requisitos atendidos |
|---|---|---|
| `User` | Identidade, credenciais e papel do usuário | RF01, RF02 |
| `Address` | Endereço de coleta pertencente ao morador | RF03, RF04 |
| `CollectorProfile` | Dados específicos do coletor e vínculo com a EcoRota | RF02, RF08, RF09, RF10 |
| `CollectionRequest` | Solicitação, agendamento, integração externa e status atual | RF04, RF05, RF06, RF08-RF15 |
| `RequestMaterial` | Um ou mais materiais associados à solicitação | RF05, RF09 |
| `RequestStatusHistory` | Linha do tempo confiável das mudanças da coleta | RF06, RF11, RF12, RF15 |
| `PointsLog` | Crédito idempotente de pontos após conclusão | RF13, RF16, RF17 |
| `SystemState` | `generation` e `revision` aplicadas do stream EcoRota | RF14, RF15 e resiliência |

## 4. Diagrama entidade-relacionamento

### 4.1 Modelo lógico

```mermaid
erDiagram
    direction LR

    USER ||--o{ ADDRESS : owns
    USER ||--o| COLLECTOR_PROFILE : may_have
    USER ||--o{ COLLECTION_REQUEST : requests
    ADDRESS ||--o{ COLLECTION_REQUEST : pickup_location
    COLLECTOR_PROFILE o|..o{ COLLECTION_REQUEST : assigned_to
    COLLECTION_REQUEST ||--|{ REQUEST_MATERIAL : contains
    COLLECTION_REQUEST ||--o{ REQUEST_STATUS_HISTORY : records
    USER o|..o{ REQUEST_STATUS_HISTORY : changes
    USER ||--o{ POINTS_LOG : receives
    COLLECTION_REQUEST ||--o{ POINTS_LOG : rewards

    USER {
        uuid id PK
        string name
        string email UK
        string phone UK "Optional"
        string passwordHash
        string role "MORADOR | COLETOR | OPERADOR"
        datetime createdAt
        datetime updatedAt
    }

    ADDRESS {
        uuid id PK
        uuid userId FK
        string label
        string street
        string number
        string complement "Optional"
        string district
        string city
        string state
        string zipCode
        decimal latitude
        decimal longitude
        string reference "Optional"
        string photoUrl "Optional"
        boolean isDefault
        datetime createdAt
        datetime updatedAt
    }

    COLLECTOR_PROFILE {
        uuid id PK
        uuid userId FK, UK
        string ecoRotaCollectorId UK "Optional until synchronized"
        string origin "CUSTOM"
        boolean available
        string availabilityShift "Optional"
        string syncStatus "PENDING | SYNCED | ERROR"
        datetime createdAt
        datetime updatedAt
    }

    COLLECTION_REQUEST {
        uuid id PK
        uuid residentId FK
        uuid addressId FK
        uuid collectorProfileId FK "Optional for system collector"
        string ecoRotaRequestId UK "Optional until synchronized"
        string externalReference UK
        string externalPointId "Optional"
        string externalCollectorId "Optional"
        string status "SCHEDULED | PENDING | ASSIGNED | IN_SERVICE | COMPLETED | CANCELLED"
        string syncStatus "PENDING | SYNCED | ERROR"
        datetime desiredAt
        string cancellationReason "Optional"
        string completionPhotoUrl "Optional"
        datetime completedAt "Optional"
        datetime createdAt
        datetime updatedAt
    }

    REQUEST_MATERIAL {
        uuid id PK
        uuid requestId FK
        string materialType
        decimal estimatedQuantity "Optional"
        string unit "Optional"
        datetime createdAt
    }

    REQUEST_STATUS_HISTORY {
        uuid id PK
        uuid requestId FK
        uuid changedByUserId FK "Optional for EcoRota event"
        string source "LOCAL | ECOROTA"
        string fromStatus "Optional for initial status"
        string toStatus
        string reason "Optional"
        string externalEventId UK "Optional"
        int generation "Optional"
        int revision "Optional"
        datetime occurredAt
        datetime createdAt
    }

    POINTS_LOG {
        uuid id PK
        uuid userId FK
        uuid requestId FK
        int points
        string reason
        datetime createdAt
    }

    SYSTEM_STATE {
        string key PK "Example ecorota_stream"
        int generation
        int lastRevision
        datetime lastSnapshotAt "Optional"
        datetime updatedAt
    }
```

### 4.2 Modelo conceitual no estilo Chen

O diagrama abaixo apresenta a mesma modelagem em uma notação conceitual semelhante à referência de Chen:

- retângulos representam entidades;
- losangos representam relacionamentos;
- elipses representam os atributos principais;
- `1`, `N` e `0..1` indicam as cardinalidades;
- atributos com `(PK)` são identificadores primários.

```mermaid
flowchart LR
    usuario["USUÁRIO"]
    endereco["ENDEREÇO"]
    perfilColetor["PERFIL DO COLETOR"]
    solicitacao["SOLICITAÇÃO DE COLETA"]
    material["MATERIAL SOLICITADO"]
    historico["HISTÓRICO DE STATUS"]
    pontuacao["LANÇAMENTO DE PONTOS"]

    cadastra{"cadastra"}
    realiza{"realiza"}
    possuiPerfil{"possui"}
    utiliza{"utiliza"}
    atende{"atende"}
    contem{"contém"}
    registra{"registra"}
    recebe{"recebe"}
    recompensa{"recompensa"}

    usuario ---|"1"| cadastra
    cadastra ---|"N"| endereco

    usuario ---|"1"| realiza
    realiza ---|"N"| solicitacao

    usuario ---|"1"| possuiPerfil
    possuiPerfil ---|"0..1"| perfilColetor

    endereco ---|"1"| utiliza
    utiliza ---|"N"| solicitacao

    perfilColetor ---|"1"| atende
    atende ---|"N"| solicitacao

    solicitacao ---|"1"| contem
    contem ---|"N"| material

    solicitacao ---|"1"| registra
    registra ---|"N"| historico

    usuario ---|"1"| recebe
    recebe ---|"N"| pontuacao

    solicitacao ---|"1"| recompensa
    recompensa ---|"N"| pontuacao

    usuarioId(("id_usuario (PK)"))
    usuarioNome(("nome"))
    usuarioEmail(("email"))
    usuarioPapel(("papel"))
    usuario --- usuarioId
    usuario --- usuarioNome
    usuario --- usuarioEmail
    usuario --- usuarioPapel

    enderecoId(("id_endereco (PK)"))
    enderecoLogradouro(("logradouro"))
    enderecoBairro(("bairro"))
    enderecoCoordenadas(("coordenadas"))
    endereco --- enderecoId
    endereco --- enderecoLogradouro
    endereco --- enderecoBairro
    endereco --- enderecoCoordenadas

    coletorId(("id_perfil (PK)"))
    coletorExternoId(("id_coletor_ecorota"))
    coletorDisponivel(("disponível"))
    perfilColetor --- coletorId
    perfilColetor --- coletorExternoId
    perfilColetor --- coletorDisponivel

    solicitacaoId(("id_solicitacao (PK)"))
    solicitacaoReferencia(("referência externa"))
    solicitacaoStatus(("status"))
    solicitacaoData(("data desejada"))
    solicitacao --- solicitacaoId
    solicitacao --- solicitacaoReferencia
    solicitacao --- solicitacaoStatus
    solicitacao --- solicitacaoData

    materialId(("id_material (PK)"))
    materialTipo(("tipo"))
    materialQuantidade(("quantidade estimada"))
    material --- materialId
    material --- materialTipo
    material --- materialQuantidade

    historicoId(("id_historico (PK)"))
    historicoOrigem(("origem"))
    historicoStatus(("novo status"))
    historicoData(("data da ocorrência"))
    historico --- historicoId
    historico --- historicoOrigem
    historico --- historicoStatus
    historico --- historicoData

    pontuacaoId(("id_lancamento (PK)"))
    pontuacaoValor(("pontos"))
    pontuacaoMotivo(("motivo"))
    pontuacao --- pontuacaoId
    pontuacao --- pontuacaoValor
    pontuacao --- pontuacaoMotivo

    classDef entidade fill:#FFFFFF,stroke:#1F2937,color:#000000
    classDef relacionamento fill:#FFECBD,stroke:#FFC943
    classDef atributo fill:#C2E5FF,stroke:#3DADFF

    class usuario,endereco,perfilColetor,solicitacao,material,historico,pontuacao entidade
    class cadastra,realiza,possuiPerfil,utiliza,atende,contem,registra,recebe,recompensa relacionamento
    class usuarioId,usuarioNome,usuarioEmail,usuarioPapel,enderecoId,enderecoLogradouro,enderecoBairro,enderecoCoordenadas,coletorId,coletorExternoId,coletorDisponivel,solicitacaoId,solicitacaoReferencia,solicitacaoStatus,solicitacaoData,materialId,materialTipo,materialQuantidade,historicoId,historicoOrigem,historicoStatus,historicoData,pontuacaoId,pontuacaoValor,pontuacaoMotivo atributo
```

Esse modelo conceitual mostra apenas os atributos mais relevantes para entendimento do domínio. Chaves estrangeiras, campos de auditoria, sincronização e timestamps permanecem detalhados no modelo lógico da seção 4.1. A entidade `SystemState` também permanece somente no modelo lógico porque funciona como controle técnico da integração e não possui relacionamento de domínio com as demais entidades.

## 5. Relacionamentos e cardinalidades

### 5.1 `User` e `Address`

Um usuário morador pode cadastrar nenhum ou vários endereços. Cada endereço pertence exatamente a um usuário.

```text
User 1 -> 0..N Address
```

### 5.2 `User` e `CollectorProfile`

Um usuário pode não possuir perfil de coletor ou possuir exatamente um. Um perfil de coletor pertence a exatamente um usuário.

```text
User 1 -> 0..1 CollectorProfile
```

O campo `role` de `User` determina se o usuário pode acessar as funcionalidades de morador, coletor ou operador. `CollectorProfile` guarda apenas informações específicas do coletor.

### 5.3 `User`, `Address` e `CollectionRequest`

Um morador pode realizar várias solicitações. Cada solicitação pertence a um morador e utiliza um endereço cadastrado por ele.

```text
User 1 -> 0..N CollectionRequest
Address 1 -> 0..N CollectionRequest
```

O serviço deve validar que o `Address.userId` é igual ao `CollectionRequest.residentId`.

### 5.4 `CollectorProfile` e `CollectionRequest`

Uma solicitação pode ainda não possuir coletor, pode ser atendida por um coletor `system` da EcoRota ou pode ser atribuída a um coletor `custom` da aplicação.

- `collectorProfileId`: utilizado quando existe um coletor `custom` com usuário local;
- `externalCollectorId`: utilizado para registrar o coletor informado pela EcoRota, inclusive coletores `system`.

Essa relação é opcional porque a solicitação pode estar aguardando atribuição.

### 5.5 `CollectionRequest` e `RequestMaterial`

Toda solicitação precisa possuir pelo menos um material. A entidade separada permite registrar vários tipos de materiais sem duplicar a solicitação.

```text
CollectionRequest 1 -> 1..N RequestMaterial
```

### 5.6 `CollectionRequest` e `RequestStatusHistory`

`CollectionRequest.status` representa o estado atual para consultas rápidas. `RequestStatusHistory` registra cada alteração e preserva o histórico exigido pelo case.

Cada registro informa:

- status anterior e novo status;
- data efetiva da mudança;
- origem local ou EcoRota;
- usuário responsável, quando existir;
- identificador e revisão do evento externo, quando existir.

### 5.7 `CollectionRequest` e `PointsLog`

Uma solicitação pode gerar lançamentos separados para o morador e para o coletor. A combinação `PointsLog.userId` e `PointsLog.requestId` é única para impedir que o mesmo usuário receba duas vezes os pontos da mesma coleta.

```text
CollectionRequest 1 -> 0..N PointsLog
User 1 -> 0..N PointsLog
```

### 5.8 `SystemState`

`SystemState` é uma entidade técnica independente, utilizada para persistir o último `generation` e `revision` processados do stream EcoRota. Isso permite detectar reset do cenário, rejeitar eventos antigos e retomar a sincronização após reinício do backend.

## 6. Regras de integridade

1. `User.email` deve ser único.
2. `User.role` deve aceitar apenas `MORADOR`, `COLETOR` ou `OPERADOR`.
3. `CollectorProfile.userId` deve ser único.
4. `CollectionRequest.externalReference` deve ser único e criado antes da chamada à EcoRota.
5. `CollectionRequest.ecoRotaRequestId` deve ser único quando preenchido.
6. Toda solicitação deve possuir pelo menos um `RequestMaterial`.
7. O endereço utilizado precisa pertencer ao morador da solicitação.
8. Apenas solicitações nos estados permitidos podem ser canceladas.
9. Apenas uma solicitação `IN_SERVICE` pode ser concluída pelo coletor responsável.
10. `COMPLETED` e `CANCELLED` são estados finais.
11. Um `PointsLog` só pode ser criado para uma solicitação `COMPLETED`.
12. A unicidade composta de `PointsLog.userId` e `PointsLog.requestId` deve garantir a idempotência da recompensa para cada participante.
13. Eventos com `generation` anterior ou `revision` já processada devem ser ignorados.
14. Credenciais, senhas e tokens nunca devem ser armazenados sem proteção ou retornados pela API.

## 7. Enumerações sugeridas

As enumerações abaixo não são entidades independentes porque representam conjuntos fechados de valores.

```text
UserRole
- MORADOR
- COLETOR
- OPERADOR

RequestStatus
- SCHEDULED
- PENDING
- ASSIGNED
- IN_SERVICE
- COMPLETED
- CANCELLED

SyncStatus
- PENDING
- SYNCED
- ERROR

StatusSource
- LOCAL
- ECOROTA

MaterialType
- PAPER
- PLASTIC
- GLASS
- METAL
- ELECTRONICS
- ORGANIC
- OTHER
```

A lista de materiais deve ser confirmada com o contrato oficial da API EcoRota antes da implementação.

## 8. Entidades futuras, fora do MVP essencial

As seguintes entidades podem ser adicionadas depois, sem bloquear o fluxo principal:

| Entidade futura | Uso |
|---|---|
| `Badge` e `UserBadge` | Selos e conquistas do morador |
| `Goal` e `UserGoal` | Metas mensais de reciclagem |
| `Notification` | Registro de notificações enviadas |
| `CollectionEvidence` | Múltiplas fotos e comprovantes por atendimento |
| `SyncAttempt` | Auditoria detalhada de retries da integração |

## 9. Autenticação definida para o MVP

A autenticação será implementada no Fastify. O backend armazenará `passwordHash` em `User`, validará as credenciais e emitirá um JWT assinado em cookie `httpOnly`.

O Supabase será utilizado somente como PostgreSQL hospedado. Supabase Auth não será utilizado no MVP e o frontend não acessará diretamente as tabelas do banco.

O JWT deverá conter apenas os dados mínimos da sessão, como identificador do usuário e papel. Senhas, hashes, credenciais da EcoRota e outros segredos nunca devem fazer parte do token.

Os papéis oficiais são:

- `MORADOR`;
- `COLETOR`;
- `OPERADOR`.

## 10. Estado atual e planejamento da implementação

Esta seção diferencia o que já existe no repositório da arquitetura-alvo descrita neste documento. A presença de uma decisão no WAD não significa que ela já esteja implementada.

### 10.1 Já implementado no repositório

| Área | Estado atual |
|---|---|
| Monorepo | Estrutura com `apps/api`, `apps/web` e `packages/shared`, utilizando TypeScript e `pnpm`. |
| Fastify | Aplicação configurada com rota modular `GET /api/v1/saude`, tratamento central de erros e resposta 404 padronizada. |
| Configuração | `.env` centralizado na raiz e validado quanto a ambiente, porta, URI PostgreSQL, integração EcoRota e tamanho do segredo JWT. |
| Prisma | Prisma 7.10 configurado com adapter PostgreSQL, fábrica de conexão, cliente tipado gerado e todos os models do DER implementados no `schema.prisma`. |
| Migration | Migration inicial aplicada no Supabase com enums, oito tabelas, índices, unicidades, chaves estrangeiras e RLS habilitado. |
| Organização modular | Módulo de saúde implementado como referência, separado em rota, serviço e repositório. |
| Primeiro fluxo | Endereços, criação e consulta de solicitações, histórico, cancelamento, atribuição temporária, início, conclusão e consulta de pontos implementados em rotas, serviços e repositórios. |
| Integração HTTP | Contrato `EcoRotaClient`, adaptadores HTTP/fake, Bearer token, timeout, validação do envelope e vínculo inicial da criação/cancelamento/conclusão implementados. A chamada real permanece inativa enquanto a credencial não estiver no `.env`. |
| Identidade temporária | Cabeçalho `x-usuario-id` disponível somente em desenvolvimento/teste, com usuário e papel sempre consultados no banco. Não substitui a autenticação planejada. |
| Regras de negócio | RN02, RN03, RN05 e RN06 aplicadas no primeiro fluxo local; transições de estado e autorização por papel também validadas. RN01 continua dependendo da confirmação dupla na interface. |
| Estado operacional | `OperationState` aplica snapshots integrais e eventos de pontos, coletores, rotas, solicitações e simulação com controle de geração, revisão e duplicidade. |
| Consultas operacionais | Endpoints de pontos, detalhe e coletores disponíveis leem o `OperationState`, calculam distância/raio e sinalizam dados ou telemetria desatualizados. |
| WebSocket EcoRota | Consumidor WSS, validação de mensagens, Bearer no handshake, reconexão com backoff/jitter e persistência do cursor implementados; ativação real aguarda credencial. |
| Sincronização de domínio | Eventos e snapshots atualizam `CollectionRequest`, vínculo externo, histórico `ECOROTA` e pontos em transação idempotente. |
| Socket.IO | O módulo de transmissão acompanha o novo formato de snapshot/eventos, mas ainda não está conectado ao bootstrap da API nem possui autenticação e salas. |
| Tipos compartilhados | Existem tipos iniciais de ponto, coletor, snapshot e evento, além da tradução básica de status. |
| Frontend | React e Vite estão configurados; as áreas de morador e coletor ainda são placeholders. |
| Mapa | O componente utiliza dados simulados. MapLibre já existe, mas o código ainda contém integração legada com Google Maps. |
| Testes | Testes automatizados da fundação e verificador ponta a ponta do primeiro fluxo executado contra o Supabase. |

### 10.2 Planejado e ainda não implementado

| Área | Trabalho pendente |
|---|---|
| Autenticação | Implementar hash de senha, JWT, cookie `httpOnly`, sessão, logout e autorização para `MORADOR`, `COLETOR` e `OPERADOR`. |
| API REST | Implementar os endpoints restantes de perfil, disponibilidade, exploração operacional e painel definidos na seção 12. |
| Regras de negócio | Integrar a capacidade real do coletor com a EcoRota e substituir a pontuação fixa provisória pela regra definitiva. |
| Integração HTTP | Adicionar retentativa automática controlada, observabilidade e validar o fluxo real assim que a credencial da equipe for configurada. |
| WebSocket EcoRota | Conectar com a credencial real e validar queda/retorno no ambiente da equipe. A sincronização com o domínio já está implementada e testada com eventos simulados. |
| Socket.IO | Conectar ao servidor Fastify, autenticar a conexão, criar salas e emitir os eventos públicos em português. |
| Estado operacional | Validar as consultas com o snapshot real da equipe e conectar os dados às telas e ao mapa. |
| Frontend | Implementar os fluxos do morador, coletor e operador consumindo a API real. |
| MapLibre | Remover a integração legada com Google Maps e manter o MapLibre como solução única do mapa. |
| Testes | Ampliar os testes unitários e executar o fluxo completo com a integração EcoRota, ainda ausente. |
| Deploy | Definir e configurar o ambiente de publicação da API e do frontend. |

### 10.3 Ordem de implementação do modelo de dados

O diagrama deste documento representa o modelo implementado no Prisma. O acompanhamento desta etapa é:

| Etapa | Situação |
|---|---|
| Definir os enums | Concluída |
| Completar `User` | Concluída |
| Implementar `Address` e `CollectorProfile` | Concluída |
| Implementar `CollectionRequest` e `RequestMaterial` | Concluída |
| Implementar `RequestStatusHistory` | Concluída |
| Implementar `PointsLog` | Concluída |
| Implementar `SystemState` | Concluída |
| Revisar índices e restrições de unicidade | Concluída |
| Gerar e revisar a migration inicial | Concluída |
| Aplicar a migration no PostgreSQL do Supabase | Concluída |

## 11. Premissas adotadas

1. O banco Supabase é utilizado como PostgreSQL hospedado; o frontend não acessa suas tabelas diretamente.
2. Toda regra de negócio passa pelo backend Fastify.
3. A EcoRota é a fonte oficial dos dados operacionais em tempo real.
4. O banco PostgreSQL da aplicação, hospedado no Supabase, é a fonte oficial de usuários, endereços, gamificação e histórico próprio.
5. Uma solicitação pode conter mais de um material.
6. Coletores `system` não precisam possuir usuário local.
7. O histórico de status é persistido para auditoria e acompanhamento do morador.
8. Pontos são concedidos uma única vez e somente após confirmação de conclusão.

## 12. Mapeamento dos endpoints da API

Esta seção define o contrato REST alvo do MVP. A rota `GET /api/v1/saude` já está implementada; os demais endpoints ainda deverão ser implementados no Fastify.

### 12.1 Padrão de nomenclatura

- prefixo de versão: `/api/v1`;
- caminhos em português, minúsculos, sem acentos e com palavras separadas por hífen;
- substantivos no plural para coleções, como `/enderecos` e `/solicitacoes-coleta`;
- ações que representam mudanças de estado usam substantivos, como `/cancelamento` e `/conclusao`;
- corpo e resposta JSON em português, usando `camelCase`;
- identificadores no formato UUID;
- datas no padrão ISO 8601 e armazenadas em UTC;
- autenticação enviada por cookie `httpOnly`;
- paginação com os parâmetros `pagina` e `limite`;
- filtros adicionais enviados pela query string.

O contrato público utiliza valores em português. O serviço de integração é responsável por convertê-los para os valores usados internamente e pela API EcoRota.

| Conceito | Valor interno/EcoRota | Valor na API pública |
|---|---|---|
| Agendada | `SCHEDULED` | `AGENDADA` |
| Pendente | `PENDING` | `PENDENTE` |
| Atribuída | `ASSIGNED` | `ATRIBUIDA` |
| Em atendimento | `IN_SERVICE` | `EM_ATENDIMENTO` |
| Concluída | `COMPLETED` | `CONCLUIDA` |
| Cancelada | `CANCELLED` | `CANCELADA` |
| Sincronização pendente | `PENDING` | `PENDENTE` |
| Sincronizada | `SYNCED` | `SINCRONIZADO` |
| Erro de sincronização | `ERROR` | `ERRO` |

O mesmo padrão se aplica aos materiais: `PAPER` vira `PAPEL`, `PLASTIC` vira `PLASTICO`, `GLASS` vira `VIDRO`, `METAL` permanece `METAL`, `ELECTRONICS` vira `ELETRONICOS`, `ORGANIC` vira `ORGANICO` e `OTHER` vira `OUTRO`.

Exemplo de erro padronizado:

```json
{
  "codigo": "SOLICITACAO_NAO_ENCONTRADA",
  "mensagem": "A solicitação de coleta não foi encontrada.",
  "detalhes": null
}
```

### 12.2 Saúde da aplicação

| Método | Endpoint | Acesso | Finalidade |
|---|---|---|---|
| `GET` | `/api/v1/saude` | Público | Verificar se a API está em execução. |

> Implementado: a rota provisória `GET /health` foi removida e substituída por `GET /api/v1/saude`.

### 12.3 Autenticação e sessão

| Método | Endpoint | Acesso | Finalidade | Requisito |
|---|---|---|---|---|
| `POST` | `/api/v1/autenticacao/cadastro` | Público | Cadastrar morador ou coletor. | RF01, RF02 |
| `POST` | `/api/v1/autenticacao/entrar` | Público | Validar credenciais e criar a sessão. | RF01 |
| `POST` | `/api/v1/autenticacao/sair` | Autenticado | Encerrar a sessão e remover o cookie. | RF01 |
| `GET` | `/api/v1/autenticacao/sessao` | Autenticado | Retornar o usuário e o papel da sessão atual. | RF02 |

O cadastro recebe `nome`, `email`, `telefone`, `senha` e `papel`. O backend nunca deve retornar a senha nem o hash da senha.

### 12.4 Perfil e endereços

| Método | Endpoint | Acesso | Finalidade | Requisito |
|---|---|---|---|---|
| `GET` | `/api/v1/perfil` | Autenticado | Consultar os dados do usuário atual. | RF01, RF02 |
| `PATCH` | `/api/v1/perfil` | Autenticado | Atualizar nome e telefone do usuário atual. | RF01 |
| `GET` | `/api/v1/enderecos` | Morador | Listar os próprios endereços. | RF03 |
| `POST` | `/api/v1/enderecos` | Morador | Cadastrar um endereço. | RF03 |
| `GET` | `/api/v1/enderecos/:enderecoId` | Morador | Consultar um endereço próprio. | RF03 |
| `PATCH` | `/api/v1/enderecos/:enderecoId` | Morador | Atualizar endereço, foto ou definição de endereço padrão. | RF03 |
| `DELETE` | `/api/v1/enderecos/:enderecoId` | Morador | Excluir um endereço que não esteja vinculado a uma coleta ativa. | RF03 |

O usuário é obtido da sessão. Por isso, não se envia `usuarioId` na URL nem no corpo dessas operações.

### 12.5 Solicitações de coleta

| Método | Endpoint | Acesso | Finalidade | Requisito |
|---|---|---|---|---|
| `POST` | `/api/v1/solicitacoes-coleta` | Morador | Criar e integrar uma solicitação com a EcoRota. | RF04, RF05, RF14 |
| `GET` | `/api/v1/solicitacoes-coleta` | Morador | Listar as próprias solicitações, com filtros por status e período. | RF06, RF12 |
| `GET` | `/api/v1/solicitacoes-coleta/:solicitacaoId` | Morador ou coletor responsável | Consultar os detalhes da solicitação. | RF06, RF09 |
| `GET` | `/api/v1/solicitacoes-coleta/:solicitacaoId/historico-status` | Morador ou coletor responsável | Consultar a linha do tempo da coleta. | RF06, RF12, RF15 |
| `POST` | `/api/v1/solicitacoes-coleta/:solicitacaoId/cancelamento` | Morador ou coletor responsável | Cancelar a solicitação e registrar o motivo. | RF11 |
| `POST` | `/api/v1/solicitacoes-coleta/:solicitacaoId/inicio` | Coletor responsável | Iniciar o atendimento da coleta. | RF10 |
| `POST` | `/api/v1/solicitacoes-coleta/:solicitacaoId/conclusao` | Coletor responsável | Concluir a coleta e registrar a foto comprobatória. | RF10, RF13, RF16 |

No cancelamento, a interface deve solicitar confirmação dupla e o backend deve rejeitar a operação quando faltar menos de 1 dia para o horário agendado, conforme RN01 e RN02.

Filtros previstos para a listagem:

```text
GET /api/v1/solicitacoes-coleta?status=PENDENTE&dataInicio=2026-09-01&dataFim=2026-09-30&pagina=1&limite=20
```

Exemplo de criação:

```json
{
  "enderecoId": "4ef751bd-d62f-4a1d-a6ea-f018f2cf9be5",
  "dataDesejada": "2026-09-25T14:00:00.000Z",
  "pontoColetaExternoId": "550e8400-e29b-41d4-a716-446655440000",
  "materiais": [
    {
      "tipo": "PLASTICO",
      "quantidadeEstimada": 5,
      "unidade": "kg"
    }
  ]
}
```

Resposta esperada após a criação:

```json
{
  "id": "1d154150-90e0-44bd-99bc-216697824c2a",
  "referenciaExterna": "pedido-1d154150-90e0-44bd-99bc-216697824c2a",
  "status": "PENDENTE",
  "statusSincronizacao": "SINCRONIZADO",
  "dataDesejada": "2026-09-25T14:00:00.000Z"
}
```

### 12.6 Área do coletor

| Método | Endpoint | Acesso | Finalidade | Requisito |
|---|---|---|---|---|
| `GET` | `/api/v1/coletor/solicitacoes` | Coletor | Listar as coletas atribuídas ao coletor atual. | RF08 |
| `GET` | `/api/v1/coletor/disponibilidade` | Coletor | Consultar disponibilidade e turno atuais. | RF08 |
| `PATCH` | `/api/v1/coletor/disponibilidade` | Coletor | Alterar disponibilidade e turno e sincronizar com a EcoRota. | RF08, RF14 |

Os detalhes e as mudanças de estado usam os endpoints compartilhados de `/solicitacoes-coleta/:solicitacaoId`. O backend deve validar que a solicitação está atribuída ao coletor autenticado.

### 12.7 Exploração de pontos e coletores

| Método | Endpoint | Acesso | Finalidade | Origem dos dados | Requisito |
|---|---|---|---|---|---|
| `GET` | `/api/v1/pontos-coleta` | Autenticado | Listar pontos de coleta, com localização e situação. | `OperationState` | RF07 |
| `GET` | `/api/v1/pontos-coleta/:pontoId` | Autenticado | Consultar os detalhes de um ponto. | `OperationState` | RF07 |
| `GET` | `/api/v1/coletores/disponiveis` | Autenticado | Listar coletores disponíveis próximos de uma coordenada. | `OperationState` | RF07 |

Filtros geográficos sugeridos:

```text
GET /api/v1/pontos-coleta?latitude=-23.5505&longitude=-46.6333&raioKm=10
GET /api/v1/coletores/disponiveis?latitude=-23.5505&longitude=-46.6333&raioKm=10
```

### 12.8 Pontuação e classificação

| Método | Endpoint | Acesso | Finalidade | Requisito |
|---|---|---|---|---|
| `GET` | `/api/v1/pontuacao/resumo` | Morador ou coletor | Consultar saldo, total acumulado e impacto registrado. | RF13, RF17 |
| `GET` | `/api/v1/pontuacao/lancamentos` | Morador ou coletor | Listar os créditos de pontos do usuário. | RF16, RF17 |
| `GET` | `/api/v1/pontuacao/classificacao` | Autenticado | Consultar a classificação dos participantes. | RF17 |

Não deve existir endpoint público para conceder pontos. O lançamento é criado internamente quando o backend confirma o evento de conclusão da EcoRota.

### 12.9 Operação EcoRota

| Método | Endpoint | Acesso | Finalidade | Requisito |
|---|---|---|---|---|
| `GET` | `/api/v1/operacao/indicadores` | Operador | Retornar KPIs de coletas e coletores. | RF18 |
| `GET` | `/api/v1/operacao/solicitacoes` | Operador | Listar solicitações recentes e seus estados. | RF18 |
| `GET` | `/api/v1/operacao/coletores` | Operador | Exibir coletores, disponibilidade e última posição. | RF18 |
| `GET` | `/api/v1/operacao/pontos-coleta` | Operador | Exibir os pontos usados no mapa operacional. | RF18 |
| `GET` | `/api/v1/operacao/usuarios` | Operador | Listar informações básicas de moradores e coletores. | RF18 |
| `GET` | `/api/v1/operacao/integracao` | Operador | Informar conexão, `generation`, última `revision` e horário do snapshot. | RF14, RF15 |

### 12.10 Comunicação em tempo real

O Socket.IO utiliza o namespace `/tempo-real`. Depois de autenticado, o cliente entra apenas nas salas autorizadas para seu papel e usuário.

| Evento | Destinatário | Conteúdo |
|---|---|---|
| `operacao:estado-inicial` | Operador | Snapshot atual de pontos, coletores e solicitações. |
| `coletor:posicao-atualizada` | Operador e morador relacionado | Posição, horário de observação e indicação de telemetria antiga. |
| `solicitacao:status-atualizado` | Morador, coletor responsável e operador | Identificador, status anterior, novo status e data da mudança. |
| `solicitacao:atribuida` | Morador, coletor responsável e operador | Dados básicos da atribuição. |
| `solicitacao:concluida` | Morador, coletor responsável e operador | Confirmação da conclusão e pontuação concedida. |

O WebSocket da EcoRota continua sendo consumido exclusivamente pelo backend. Navegadores nunca recebem a credencial externa nem se conectam diretamente à plataforma.

### 12.11 Códigos HTTP esperados

| Código | Uso |
|---|---|
| `200` | Consulta ou atualização concluída. |
| `201` | Recurso criado. |
| `204` | Exclusão ou encerramento sem corpo de resposta. |
| `400` | Corpo, parâmetro ou transição de status inválida. |
| `401` | Sessão ausente ou inválida. |
| `403` | Usuário sem permissão para a operação. |
| `404` | Recurso não encontrado ou não pertencente ao usuário. |
| `409` | Conflito de regra de negócio ou duplicidade. |
| `422` | Dados válidos sintaticamente, mas rejeitados pela regra de negócio. |
| `429` | Limite de requisições excedido. |
| `502` | Falha de comunicação com a API EcoRota. |
| `503` | Serviço ou sincronização temporariamente indisponível. |

### 12.12 Ordem recomendada de implementação

1. `saude` e tratamento padronizado de erros;
2. `autenticacao` e controle de acesso por papel;
3. `perfil` e `enderecos`;
4. criação, consulta e cancelamento de `solicitacoes-coleta`;
5. rotas do `coletor`, início e conclusão;
6. leitura de `pontos-coleta` e `coletores/disponiveis` pelo `OperationState`;
7. `pontuacao` acionada pela conclusão confirmada;
8. endpoints de `operacao`;
9. eventos do namespace `/tempo-real`.

## 13. Requisitos do sistema

Esses requisitos são a referência funcional e de qualidade para a modelagem, os endpoints, as regras dos serviços e os testes do EcoRota.

### 13.1 Requisitos funcionais

| ID | Requisito funcional | Prioridade |
|---|---|---|
| RF01 | Permitir cadastro e login de usuários. | Essencial |
| RF02 | Permitir identificar o perfil do usuário: morador ou coletor. | Essencial |
| RF03 | Permitir ao morador cadastrar ou selecionar um endereço. | Essencial |
| RF04 | Permitir ao morador solicitar uma coleta. | Essencial |
| RF05 | Permitir informar material e data desejada. | Essencial |
| RF06 | Permitir acompanhar o status da coleta. | Essencial |
| RF07 | Permitir localizar pontos de coleta ou coletores disponíveis. | Essencial |
| RF08 | Permitir ao coletor visualizar as coletas atribuídas. | Essencial |
| RF09 | Permitir ao coletor visualizar detalhes da coleta. | Essencial |
| RF10 | Permitir ao coletor confirmar ou concluir uma coleta. | Essencial |
| RF11 | Permitir o cancelamento de uma coleta. | Essencial |
| RF12 | Registrar o histórico de coletas do morador. | Essencial |
| RF13 | Dar retorno ao morador e ao coletor após uma coleta concluída. | Essencial |
| RF14 | Integrar as solicitações com a API EcoRota. | Essencial |
| RF15 | Sincronizar o status da coleta entre o sistema e a API EcoRota. | Essencial |
| RF16 | Garantir que pontos ou recompensas sejam concedidos somente após a conclusão. | Importante |
| RF17 | Permitir ao morador e ao coletor visualizar saldo, pontos ou reconhecimento. | Importante |
| RF18 | Permitir à EcoRota acompanhar informações básicas da operação em um dashboard. | Importante |
| RF18.1 | Exibir no dashboard o número de coletas realizadas por período: dia, semana e mês. | Importante |
| RF18.2 | Exibir demanda por bairro ou região, comparando o volume solicitado com a capacidade de coleta ofertada. | Importante |
| RF18.3 | Exibir indicadores de tração: novos moradores cadastrados e taxa de coletas concluídas versus canceladas. | Importante |
| RF21 | O sistema deve ser responsivo, adaptando-se a diferentes tamanhos de tela: desktop, tablet e celular. | Essencial |
| RF22 | A aplicação web deve ter aparência e comportamento próximos aos de um aplicativo móvel quando acessada por celular, incluindo navegação simplificada, botões grandes e layout otimizado para toque. | Essencial |

Os identificadores RF19 e RF20 não aparecem no documento de origem. A numeração foi preservada para evitar alterar referências já usadas pelo time. Embora RF21 e RF22 descrevam características de interface normalmente classificadas como não funcionais, eles permanecem nesta categoria por fidelidade ao documento de origem.

### 13.2 Regras de negócio

| ID | Regra de negócio | Requisito associado |
|---|---|---|
| RN01 | Exigir confirmação dupla para cancelar uma coleta, evitando cancelamentos acidentais. | RF11 |
| RN02 | Permitir o cancelamento somente até o prazo mínimo de 1 dia antes do horário agendado. | RF11 |
| RN03 | Creditar pontos ou recompensa ao morador e ao coletor somente após a coleta ser confirmada como concluída pelo coletor. | RF13, RF16 |
| RN04 | Impedir que um coletor tenha mais coletas atribuídas do que sua capacidade disponível na API. | RF08, RF14 |
| RN05 | Manter o histórico de coletas, inclusive as canceladas, após qualquer alteração de status, garantindo rastreabilidade. | RF12 |
| RN06 | Impedir duplicidade: não permitir duas solicitações abertas para o mesmo endereço na mesma data. | RF04 |
| RN07 | Sincronizar o status da coleta entre o sistema e a API EcoRota em tempo quase real, utilizando WebSocket quando disponível. | RF15 |

Para manter uma numeração contínua no WAD, os identificadores foram normalizados sem alterar o conteúdo das regras. A equivalência com a numeração original da `docs_mafe` é:

| Identificador no WAD | Identificador original na `docs_mafe` |
|---|---|
| RN01 | RN01 |
| RN02 | RN02 |
| RN03 | RN03 |
| RN04 | RN05 |
| RN05 | RN07 |
| RN06 | RN08 |
| RN07 | RN09 |

#### Aplicação das regras no backend

| Regra | Camada responsável | Validação esperada |
|---|---|---|
| RN01 | Frontend e serviço de solicitações | A interface pede a confirmação dupla; o serviço recebe a intenção final de cancelamento. |
| RN02 | Serviço de solicitações | Comparar a data atual com `dataDesejada` e rejeitar cancelamentos fora do prazo. |
| RN03 | Serviço de gamificação | Criar `PointsLog` apenas depois da conclusão confirmada e usar `requestId` único para evitar crédito duplicado. |
| RN04 | Serviço de coletores e integração EcoRota | Consultar a capacidade disponível antes de aceitar ou atribuir uma nova coleta. |
| RN05 | Serviço de solicitações | Nunca apagar o histórico ao atualizar ou cancelar uma solicitação. |
| RN06 | Serviço e banco de dados | Consultar solicitações abertas do endereço na data e impedir duplicidade. |
| RN07 | Integração WebSocket | Aplicar eventos por `generation` e `revision`, atualizar o estado local e notificar o frontend. |

### 13.3 Requisitos não funcionais

| ID | Eixo ISO/IEC 25010 | Requisito | RF/RN associado |
|---|---|---|---|
| RNF01 | Usabilidade (`USAB`) | O morador deve conseguir solicitar uma coleta em no máximo 3 telas, sem necessidade de treinamento. | RF04, RN01 |
| RNF02 | Confiabilidade (`CONF`) | O sistema deve continuar operando com dados em cache ou armazenamento local caso a API EcoRota fique temporariamente indisponível. | RF14, RF15 |
| RNF03 | Desempenho (`DES`) | O dashboard deve carregar os indicadores agregados em até 3 segundos. | RF18.1–RF18.3 |
| RNF04 | Capacidade (`CAP`) | O sistema deve suportar o crescimento do número de bairros e coletores sem redesenho da arquitetura. | RF07, RF08 |
| RNF05 | Segurança (`SEG`) | O sistema deve autenticar usuários e restringir funcionalidades por perfil: morador, coletor e EcoRota/operador. | RF02 |
| RNF06 | Restrição (`REST`) | A integração com a coleta deve utilizar obrigatoriamente a API EcoRota fornecida. | RF14 |
| RNF07 | Suportabilidade (`SUP`) | A arquitetura deve separar claramente a lógica de negócio da integração com a API EcoRota, permitindo evoluir a integração sem afetar as demais camadas. | RF14 |
| RNF08 | Usabilidade (`USAB`) | A interface do coletor deve ser acessível a coletores autônomos com baixo letramento digital, priorizando textos curtos, ícones claros, alto contraste e poucos passos por ação. | RF08, RF09, RF10 |

### 13.4 Impacto dos requisitos na arquitetura

| Requisito | Decisão arquitetural |
|---|---|
| RNF01 e RF22 | Fluxo responsivo de solicitação limitado a três etapas e otimizado para toque. |
| RNF02 | `OperationState` em memória, persistência de solicitações pendentes e fila local no frontend para ações feitas sem conexão. |
| RNF03 | Indicadores pré-calculados e leitura do cache, evitando chamadas à EcoRota a cada acesso ao dashboard. |
| RNF04 | Módulos desacoplados, banco relacional e consultas paginadas. |
| RNF05 | JWT em cookie `httpOnly` e autorização baseada nos papéis `MORADOR`, `COLETOR` e `OPERADOR`. |
| RNF06 | `EcoRotaClient` como único caminho para criar, atualizar, concluir ou cancelar operações externas. |
| RNF07 | Separação entre rotas, serviços, repositórios e adaptador de integração. |
| RNF08 | Interface do coletor com ações diretas, alto contraste, textos curtos e poucos campos. |
