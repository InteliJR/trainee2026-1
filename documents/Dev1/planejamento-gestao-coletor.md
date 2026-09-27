# Planejamento e implementação da gestão do coletor

> **Situação em 24/09/2026:** consulta de solicitações, consulta de disponibilidade e alteração sincronizável implementadas e verificadas no Supabase.

## 1. Endpoints

| Método | Endpoint | Função |
|---|---|---|
| `GET` | `/api/v1/coletor/solicitacoes` | Lista somente solicitações atribuídas ao coletor atual. |
| `GET` | `/api/v1/coletor/disponibilidade` | Consulta disponibilidade, turno, vínculo externo e sincronização. |
| `PATCH` | `/api/v1/coletor/disponibilidade` | Altera disponibilidade e turno. |

## 2. Alteração de disponibilidade

Exemplo:

```json
{
  "disponivel": true,
  "turno": "MANHA"
}
```

Regras:

- somente o papel `COLETOR` pode acessar;
- o usuário precisa possuir `CollectorProfile`;
- apenas perfil de origem `CUSTOM` é editável;
- para ficar disponível, o coletor precisa possuir turno;
- ficar indisponível não remove solicitações já atribuídas;
- quando não existe integração ativa ou ID externo, a alteração fica `PENDING`;
- com integração ativa, o backend chama `PATCH /v1/collectors/:id`;
- confirmação externa marca `SYNCED`;
- falha externa preserva o estado local, marca `ERROR` e retorna `502`.

## 3. Listagem de solicitações

A listagem reaproveita as regras existentes de paginação, período e status, mas força o contexto do coletor atual. O identificador do coletor não é recebido pela URL ou pelo corpo.

Exemplo:

```text
GET /api/v1/coletor/solicitacoes?status=ATRIBUIDA&pagina=1&limite=20
```

## 4. Verificação

```bash
corepack pnpm --filter @ecorota/api collector:verify
```

O verificador consulta o perfil, altera temporariamente a disponibilidade, lista solicitações e restaura o estado original do perfil ao final.

## 5. Situação atual

O Socket.IO já está conectado ao bootstrap e exige o mesmo cookie JWT das rotas REST. O verificador do coletor realiza login real, consulta o perfil, altera temporariamente a disponibilidade, lista solicitações e restaura o estado original ao final.

