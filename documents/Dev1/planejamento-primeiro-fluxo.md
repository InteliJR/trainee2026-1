# Planejamento do primeiro fluxo completo do backend

> **Situação em 23/09/2026:** etapas 0 a 7 implementadas e verificadas no Supabase. A autenticação continua intencionalmente fora deste fluxo.

## 1. Objetivo

Implementar e testar o primeiro fluxo de negócio do EcoRota sem implementar cadastro, login, logout ou JWT nesta etapa:

```text
Usuário de desenvolvimento
    -> cadastra endereço
    -> cria solicitação de coleta
    -> consulta solicitação
    -> cancela ou recebe atendimento
    -> coletor inicia e conclui a coleta
    -> sistema registra o histórico
    -> sistema concede pontos
```

## 2. Decisão temporária enquanto não existe autenticação

As rotas protegidas receberão o cabeçalho temporário `x-usuario-id`. O backend buscará esse usuário no banco e montará um contexto com `id` e `papel`.

Essa decisão permite desenvolver as regras agora sem colocar `moradorId` ou `coletorId` nos corpos das requisições. Quando o JWT for implementado, somente o middleware de identidade será substituído; rotas, serviços e repositórios continuarão usando o mesmo contexto.

Regras de segurança dessa solução temporária:

- disponível somente em `development` e `test`;
- proibida em `production`;
- o usuário informado precisa existir no banco;
- o papel é sempre lido do banco, nunca aceito por cabeçalho;
- não deve ser usado em um deploy público.

## 3. Organização dos módulos

Cada módulo seguirá a separação:

```text
modules/
  addresses/
    address.routes.ts
    address.service.ts
    address.repository.ts
    address.schemas.ts
  requests/
    request.routes.ts
    request.service.ts
    request.repository.ts
    request.schemas.ts
  gamification/
    gamification.service.ts
    gamification.repository.ts
```

- **Rotas:** recebem HTTP, validam entrada e devolvem resposta.
- **Serviços:** aplicam as regras de negócio e controlam as transações.
- **Repositórios:** executam as consultas e gravações no Prisma.
- **Schemas:** definem e validam parâmetros, query strings e corpos JSON.

## 4. Etapas de implementação

### Etapa 0 — Identidade e dados de desenvolvimento

Implementar:

- middleware temporário baseado em `x-usuario-id`;
- contexto do usuário com `id` e `papel`;
- seed idempotente com um morador, um coletor e um operador;
- perfil de coletor vinculado ao usuário coletor.

Entrega: requisições conseguem representar cada papel sem login ou JWT.

### Etapa 1 — Cadastro de endereço

Implementar:

- `POST /api/v1/enderecos`;
- `GET /api/v1/enderecos`;
- validação de CEP, UF, coordenadas e campos obrigatórios;
- vínculo automático com o usuário do contexto;
- restrição para o papel `MORADOR`;
- controle de apenas um endereço padrão por morador.

Entrega: o morador de desenvolvimento consegue cadastrar e consultar seus endereços.

### Etapa 2 — Criação da solicitação

Implementar:

- `POST /api/v1/solicitacoes-coleta`;
- validação de endereço pertencente ao morador;
- exigência de pelo menos um material;
- validação da data desejada;
- geração de `externalReference` única;
- bloqueio de solicitação aberta duplicada no mesmo endereço e data, conforme RN06;
- criação da solicitação, materiais e primeiro histórico em uma transação;
- `syncStatus=PENDING` enquanto a integração EcoRota não estiver implementada.

Entrega: solicitação local consistente, pronta para futura sincronização externa.

### Etapa 3 — Consulta e acompanhamento

Implementar:

- `GET /api/v1/solicitacoes-coleta`;
- `GET /api/v1/solicitacoes-coleta/:solicitacaoId`;
- `GET /api/v1/solicitacoes-coleta/:solicitacaoId/historico-status`;
- filtros por status e período;
- paginação;
- autorização para morador proprietário, coletor responsável ou operador.

Entrega: acompanhamento da solicitação e sua linha do tempo.

### Etapa 4 — Cancelamento

Implementar:

- `POST /api/v1/solicitacoes-coleta/:solicitacaoId/cancelamento`;
- motivo obrigatório;
- validação dos estados que permitem cancelamento;
- prazo mínimo de 1 dia para cancelamento solicitado pelo morador, conforme RN02;
- atualização da solicitação e criação do histórico na mesma transação;
- proibição de pontos para solicitação cancelada.

Entrega: cancelamento rastreável e consistente.

### Etapa 5 — Atendimento do coletor

Enquanto a integração EcoRota não atribui coletores automaticamente, será criada uma operação de desenvolvimento para associar a solicitação ao coletor de teste.

Implementar:

- associação temporária de coletor em desenvolvimento;
- `POST /api/v1/solicitacoes-coleta/:solicitacaoId/inicio`;
- `POST /api/v1/solicitacoes-coleta/:solicitacaoId/conclusao`;
- validação de que o coletor está associado à solicitação;
- transições `ASSIGNED -> IN_SERVICE -> COMPLETED`;
- registro de cada transição no histórico.

Entrega: coletor consegue executar o atendimento completo.

### Etapa 6 — Pontuação idempotente

Implementar:

- concessão automática somente após `COMPLETED`;
- lançamento separado para morador e coletor;
- unicidade de `(userId, requestId)`;
- nenhuma rota pública para conceder pontos;
- pontuação fixa e documentada para o MVP, até existir uma regra baseada em peso ou material.

Entrega: uma conclusão gera pontos uma única vez para cada participante.

### Etapa 7 — Testes e verificação no Supabase

Implementar testes para:

- morador cadastrar endereço;
- impedir endereço de outro usuário;
- criar solicitação com materiais e histórico;
- impedir duplicidade;
- consultar somente solicitações autorizadas;
- cancelar dentro e fora do prazo;
- impedir transição de status inválida;
- impedir conclusão por coletor diferente;
- criar pontos somente na conclusão;
- repetir conclusão sem duplicar pontos;
- verificar dados persistidos no Supabase.

Entrega: fluxo validado de ponta a ponta.

## 5. Ordem de execução

| Ordem | Etapa | Dependência | Resultado |
|---|---|---|---|
| 1 | Identidade temporária e seed | Banco migrado | Usuários de desenvolvimento disponíveis |
| 2 | Endereços | Identidade | Local da coleta cadastrado |
| 3 | Criação da solicitação | Endereço | Pedido local com materiais e histórico |
| 4 | Consulta | Solicitação | Acompanhamento do pedido |
| 5 | Cancelamento | Consulta e regras de status | Encerramento sem pontos |
| 6 | Atendimento | Coletor e atribuição | Início e conclusão da coleta |
| 7 | Pontuação | Conclusão | Créditos idempotentes |
| 8 | Teste integrado | Todas as etapas | Fluxo completo aprovado |

## 6. Fora do escopo desta fase

- cadastro com senha;
- login e logout;
- JWT e cookie `httpOnly`;
- recuperação de senha;
- integração HTTP com a EcoRota;
- consumidor WebSocket da EcoRota;
- upload real de imagens;
- badges, metas e recompensas financeiras.

## 7. Critério de conclusão

O primeiro fluxo estará concluído quando for possível executar, usando usuários de desenvolvimento:

```text
Criar endereço
-> criar solicitação
-> consultar solicitação e histórico
-> atribuir ao coletor de teste
-> iniciar atendimento
-> concluir
-> consultar histórico
-> confirmar pontos do morador e do coletor
```

O caminho alternativo também deverá funcionar:

```text
Criar solicitação
-> cancelar dentro do prazo
-> consultar histórico
-> confirmar ausência de pontos
```

## 8. Como executar o fluxo

Na raiz do projeto, execute:

```bash
corepack pnpm --filter @ecorota/api database:seed:development
corepack pnpm --filter @ecorota/api dev
```

O seed é idempotente e prepara estas identidades:

| Papel | `x-usuario-id` |
|---|---|
| Morador | `11111111-1111-4111-8111-111111111111` |
| Coletor | `22222222-2222-4222-8222-222222222222` |
| Operador | `33333333-3333-4333-8333-333333333333` |

Para executar automaticamente toda a jornada contra o Supabase configurado no `.env`:

```bash
corepack pnpm --filter @ecorota/api flow:verify
```

O verificador cria dados identificáveis de teste, conclui uma solicitação, repete a conclusão para conferir a idempotência, cancela outra solicitação e confirma histórico e pontos.

## 9. Ordem prática das chamadas HTTP

Todas as chamadas abaixo recebem `x-usuario-id`.

| Ordem | Papel | Operação | O que faz |
|---|---|---|---|
| 1 | Morador | `POST /api/v1/enderecos` | Cadastra o local da retirada. |
| 2 | Morador | `POST /api/v1/solicitacoes-coleta` | Cria o pedido, os materiais e o histórico inicial. |
| 3 | Morador | `GET /api/v1/solicitacoes-coleta/:solicitacaoId` | Consulta os detalhes do próprio pedido. |
| 4 | Operador | `POST /api/v1/desenvolvimento/solicitacoes-coleta/:solicitacaoId/atribuicao` | Simula a atribuição que futuramente será feita pela EcoRota. |
| 5 | Coletor | `POST /api/v1/solicitacoes-coleta/:solicitacaoId/inicio` | Muda de `ATRIBUIDA` para `EM_ATENDIMENTO`. |
| 6 | Coletor | `POST /api/v1/solicitacoes-coleta/:solicitacaoId/conclusao` | Conclui, registra foto/histórico e concede os pontos. |
| 7 | Morador ou coletor | `GET /api/v1/pontuacao/lancamentos` | Consulta o saldo e os créditos do usuário atual. |

O caminho alternativo usa `POST /api/v1/solicitacoes-coleta/:solicitacaoId/cancelamento`, com `motivo` e `confirmado: true`.

## 10. Pontuação provisória do MVP

Cada coleta concluída concede `100` pontos ao morador e `100` pontos ao coletor. A pontuação é provisória e está isolada no backend para ser substituída quando a regra definitiva for aprovada. A restrição única `(userId, requestId)` impede crédito duplicado se a conclusão for repetida.
