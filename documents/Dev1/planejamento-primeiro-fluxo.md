# Planejamento do primeiro fluxo completo do backend

> **Situação atual:** etapas 0 a 7 implementadas; o verificador agora realiza login real e usa o cookie JWT nas chamadas protegidas.

## 1. Objetivo

Implementar e testar o primeiro fluxo de negócio do EcoRota usando a sessão real do backend:

```text
Usuário autenticado por cookie JWT
    -> cadastra endereço
    -> cria solicitação de coleta
    -> consulta solicitação
    -> cancela ou recebe atendimento
    -> coletor inicia e conclui a coleta
    -> sistema registra o histórico
    -> sistema concede pontos
```

## 2. Autenticação aplicada ao fluxo

As rotas protegidas recebem o cookie `ecorota_sessao`. O backend valida assinatura e expiração do JWT, confirma no banco se o usuário e o papel continuam válidos e monta o contexto com `id` e `papel`.

Morador, coletor e operador entram por `POST /api/v1/autenticacao/entrar`. IDs de usuário continuam ausentes dos corpos das operações; serviços e repositórios usam somente o ator confirmado pelo middleware.

Regras de segurança:

- senha protegida por bcrypt;
- JWT assinado com segredo obrigatório de pelo menos 32 caracteres;
- cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção;
- usuário e papel confirmados novamente no PostgreSQL;
- papel enviado pelo cliente nunca é aceito como autorização.

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

### Etapa 0 — Autenticação e dados de desenvolvimento

Implementar:

- cadastro, login, sessão e logout;
- middleware baseado em cookie JWT;
- contexto do usuário com `id` e `papel`;
- seed idempotente com senhas bcrypt para morador, coletor e operador;
- perfil de coletor vinculado ao usuário coletor.

Entrega: requisições representam cada papel somente depois de uma sessão válida.

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
| 1 | Autenticação e seed | Banco migrado e `JWT_SECRET` | Usuários de desenvolvimento conseguem entrar e recebem cookie seguro |
| 2 | Endereços | Identidade | Local da coleta cadastrado |
| 3 | Criação da solicitação | Endereço | Pedido local com materiais e histórico |
| 4 | Consulta | Solicitação | Acompanhamento do pedido |
| 5 | Cancelamento | Consulta e regras de status | Encerramento sem pontos |
| 6 | Atendimento | Coletor e atribuição | Início e conclusão da coleta |
| 7 | Pontuação | Conclusão | Créditos idempotentes |
| 8 | Teste integrado | Todas as etapas | Fluxo completo aprovado |

## 6. Itens que continuam fora do escopo

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
corepack pnpm --filter @ecorota/api auth:verify
corepack pnpm --filter @ecorota/api dev
```

O seed é idempotente e prepara estas contas:

| Papel | E-mail |
|---|---|
| Morador | `morador.dev@ecorota.local` |
| Coletor | `coletor.dev@ecorota.local` |
| Operador | `operador.dev@ecorota.local` |

A senha é lida de `DEVELOPMENT_SEED_PASSWORD`; quando ela está vazia, o seed local utiliza `EcoRota@2026!`.

Para executar automaticamente toda a jornada contra o Supabase configurado no `.env`:

```bash
corepack pnpm --filter @ecorota/api flow:verify
```

O verificador cria dados identificáveis de teste, conclui uma solicitação, repete a conclusão para conferir a idempotência, cancela outra solicitação e confirma histórico e pontos.

## 9. Ordem prática das chamadas HTTP

Antes das chamadas abaixo, cada papel entra em `/api/v1/autenticacao/entrar`; as requisições seguintes enviam o cookie `ecorota_sessao`.

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
