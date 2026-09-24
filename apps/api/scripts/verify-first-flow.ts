import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { FakeEcoRotaClient } from '../src/integration/fake/fakeEcoRotaClient.js';
import { PrismaHealthRepository } from '../src/modules/health/health.repository.js';

const USERS = {
  resident: '11111111-1111-4111-8111-111111111111',
  collector: '22222222-2222-4222-8222-222222222222',
  operator: '33333333-3333-4333-8333-333333333333',
} as const;

const database = createPrismaClient(env.databaseUrl);
const ecoRotaClient = new FakeEcoRotaClient();
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: 'test',
  ecoRotaClient,
  logger: false,
});

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(14, 0, 0, 0);
  return date.toISOString();
}

async function request(method: 'GET' | 'POST', url: string, userId: string, payload?: object) {
  const response = await app.inject({
    method,
    url,
    headers: { 'x-usuario-id': userId },
    payload,
  });
  assert.ok(response.statusCode >= 200 && response.statusCode < 300, `${method} ${url}: ${response.statusCode} ${response.body}`);
  return response.json();
}

try {
  await database.$connect();
  await app.ready();

  const suffix = Date.now().toString().slice(-8);
  const address = await request('POST', '/api/v1/enderecos', USERS.resident, {
    rotulo: `Teste fluxo ${suffix}`,
    logradouro: 'Rua do MVP',
    numero: suffix,
    bairro: 'Vila Teste',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001-000',
    latitude: -23.55052,
    longitude: -46.633308,
    padrao: true,
  });

  const desiredDate = futureDate(3);
  const collection = await request('POST', '/api/v1/solicitacoes-coleta', USERS.resident, {
    enderecoId: address.id,
    pontoColetaExternoId: '44444444-4444-4444-8444-444444444444',
    dataDesejada: desiredDate,
    materiais: [{ tipo: 'PAPEL', quantidadeEstimada: 4.5, unidade: 'kg' }],
  });
  assert.equal(collection.statusSincronizacao, 'SYNCED');
  assert.ok(collection.integracao.solicitacaoEcoRotaId);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/v1/solicitacoes-coleta',
    headers: { 'x-usuario-id': USERS.resident },
    payload: {
      enderecoId: address.id,
      pontoColetaExternoId: '44444444-4444-4444-8444-444444444444',
      dataDesejada: desiredDate,
      materiais: [{ tipo: 'METAL' }],
    },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().codigo, 'SOLICITACAO_DUPLICADA');

  const unauthorized = await app.inject({
    method: 'GET',
    url: `/api/v1/solicitacoes-coleta/${collection.id}`,
    headers: { 'x-usuario-id': USERS.collector },
  });
  assert.equal(unauthorized.statusCode, 403);

  await request('GET', `/api/v1/solicitacoes-coleta/${collection.id}`, USERS.resident);
  await request('POST', `/api/v1/desenvolvimento/solicitacoes-coleta/${collection.id}/atribuicao`, USERS.operator, {
    coletorId: USERS.collector,
  });
  await request('POST', `/api/v1/solicitacoes-coleta/${collection.id}/inicio`, USERS.collector);
  const completed = await request('POST', `/api/v1/solicitacoes-coleta/${collection.id}/conclusao`, USERS.collector, {
    fotoUrl: 'https://example.com/comprovante.jpg',
  });
  assert.equal(completed.status, 'CONCLUIDA');
  assert.equal(completed.pontosConcedidos.length, 2);

  const repeated = await request('POST', `/api/v1/solicitacoes-coleta/${collection.id}/conclusao`, USERS.collector, {
    fotoUrl: 'https://example.com/comprovante.jpg',
  });
  assert.equal(repeated.pontosConcedidos.length, 2, 'A repetição não pode duplicar pontos.');

  const history = await request('GET', `/api/v1/solicitacoes-coleta/${collection.id}/historico-status`, USERS.resident);
  assert.deepEqual(history.dados.map((item: { statusAtual: string }) => item.statusAtual), [
    'PENDENTE', 'ATRIBUIDA', 'EM_ATENDIMENTO', 'CONCLUIDA',
  ]);

  const cancellable = await request('POST', '/api/v1/solicitacoes-coleta', USERS.resident, {
    enderecoId: address.id,
    pontoColetaExternoId: '55555555-5555-4555-8555-555555555555',
    dataDesejada: futureDate(5),
    materiais: [{ tipo: 'VIDRO', quantidadeEstimada: 2, unidade: 'kg' }],
  });
  const cancelled = await request('POST', `/api/v1/solicitacoes-coleta/${cancellable.id}/cancelamento`, USERS.resident, {
    motivo: 'Cancelamento de verificação do fluxo',
    confirmado: true,
  });
  assert.equal(cancelled.status, 'CANCELADA');
  assert.equal(cancelled.pontosConcedidos.length, 0);

  const residentPoints = await request('GET', '/api/v1/pontuacao/lancamentos', USERS.resident);
  const collectorPoints = await request('GET', '/api/v1/pontuacao/lancamentos', USERS.collector);
  assert.ok(residentPoints.dados.some((entry: { solicitacaoId: string }) => entry.solicitacaoId === collection.id));
  assert.ok(collectorPoints.dados.some((entry: { solicitacaoId: string }) => entry.solicitacaoId === collection.id));

  console.log(JSON.stringify({
    resultado: 'Fluxo completo verificado no Supabase.',
    enderecoId: address.id,
    solicitacaoConcluidaId: collection.id,
    solicitacaoCanceladaId: cancellable.id,
    historicoEventos: history.dados.length,
    creditosDaConclusao: completed.pontosConcedidos.length,
    duplicidadeBloqueada: true,
    acessoIndevidoBloqueado: true,
    integracaoFakeSincronizada: collection.statusSincronizacao === 'SYNCED',
  }, null, 2));
} finally {
  await app.close();
}
