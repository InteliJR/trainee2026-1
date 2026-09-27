/**
 * Exercita endereço, solicitação, atribuição, início, conclusão, histórico e pontos usando EcoRota fake.
 * O script valida o fluxo completo sem depender da interface web.
 */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { FakeEcoRotaClient } from '../src/integration/fake/fakeEcoRotaClient.js';
import { PrismaHealthRepository } from '../src/modules/health/health.repository.js';

// Reutiliza os UUIDs fixos criados pelo seed de desenvolvimento.
const USERS = {
  resident: 'morador.dev@ecorota.local',
  collector: 'coletor.dev@ecorota.local',
  operator: 'operador.dev@ecorota.local',
} as const;
// Usa a mesma senha configurável aplicada pelo seed de desenvolvimento.
const developmentPassword = process.env.DEVELOPMENT_SEED_PASSWORD?.trim() || 'EcoRota@2026!';

// Conecta as operações persistentes ao banco configurado.
const database = createPrismaClient(env.databaseUrl);
// Evita depender da credencial externa durante a verificação do domínio local.
const ecoRotaClient = new FakeEcoRotaClient();
// Monta a API com banco real e integração externa simulada.
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: 'test',
  jwtSecret: env.jwtSecret,
  webOrigin: env.webOrigin,
  ecoRotaClient,
  logger: false,
});

// Produz uma data ISO com antecedência suficiente para passar pela RN03.
function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(14, 0, 0, 0);
  return date.toISOString();
}

// Entra com um usuário do seed e extrai o cookie como um navegador faria.
async function login(email: string): Promise<string> {
  // Chama o endpoint real para incluir bcrypt e JWT na verificação ponta a ponta.
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/autenticacao/entrar',
    payload: { email, senha: developmentPassword },
  });
  // Interrompe cedo quando o seed ainda possui hashes antigos ou a senha configurada diverge.
  assert.equal(response.statusCode, 200, `Login ${email}: ${response.statusCode} ${response.body}`);
  // Recupera o primeiro Set-Cookie e descarta os atributos usados apenas pelo navegador.
  const setCookie = response.headers['set-cookie'];
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(header, `Login ${email} não devolveu cookie.`);
  // Retorna somente nome=valor para o cabeçalho Cookie das próximas chamadas.
  return header.split(';')[0]!;
}

// Centraliza app.inject, cookie real de sessão e validação de status bem-sucedido.
async function request(method: 'GET' | 'POST', url: string, sessionCookie: string, payload?: object) {
  const response = await app.inject({
    method,
    url,
    headers: { cookie: sessionCookie },
    payload,
  });
  assert.ok(response.statusCode >= 200 && response.statusCode < 300, `${method} ${url}: ${response.statusCode} ${response.body}`);
  return response.json();
}

try {
  await database.$connect();
  await app.ready();

  // Cria três sessões reais correspondentes aos papéis usados pela jornada.
  const sessions = {
    resident: await login(USERS.resident),
    collector: await login(USERS.collector),
    operator: await login(USERS.operator),
  };

  const suffix = Date.now().toString().slice(-8);
  const address = await request('POST', '/api/v1/enderecos', sessions.resident, {
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
  const collection = await request('POST', '/api/v1/solicitacoes-coleta', sessions.resident, {
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
    headers: { cookie: sessions.resident },
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
    headers: { cookie: sessions.collector },
  });
  assert.equal(unauthorized.statusCode, 403);

  await request('GET', `/api/v1/solicitacoes-coleta/${collection.id}`, sessions.resident);
  await request('POST', `/api/v1/desenvolvimento/solicitacoes-coleta/${collection.id}/atribuicao`, sessions.operator, {
    coletorId: '22222222-2222-4222-8222-222222222222',
  });
  await request('POST', `/api/v1/solicitacoes-coleta/${collection.id}/inicio`, sessions.collector);
  const completed = await request('POST', `/api/v1/solicitacoes-coleta/${collection.id}/conclusao`, sessions.collector, {
    fotoUrl: 'https://example.com/comprovante.jpg',
  });
  assert.equal(completed.status, 'CONCLUIDA');
  assert.equal(completed.pontosConcedidos.length, 2);

  const repeated = await request('POST', `/api/v1/solicitacoes-coleta/${collection.id}/conclusao`, sessions.collector, {
    fotoUrl: 'https://example.com/comprovante.jpg',
  });
  assert.equal(repeated.pontosConcedidos.length, 2, 'A repetição não pode duplicar pontos.');

  const history = await request('GET', `/api/v1/solicitacoes-coleta/${collection.id}/historico-status`, sessions.resident);
  assert.deepEqual(history.dados.map((item: { statusAtual: string }) => item.statusAtual), [
    'PENDENTE', 'ATRIBUIDA', 'EM_ATENDIMENTO', 'CONCLUIDA',
  ]);

  const cancellable = await request('POST', '/api/v1/solicitacoes-coleta', sessions.resident, {
    enderecoId: address.id,
    pontoColetaExternoId: '55555555-5555-4555-8555-555555555555',
    dataDesejada: futureDate(5),
    materiais: [{ tipo: 'VIDRO', quantidadeEstimada: 2, unidade: 'kg' }],
  });
  const cancelled = await request('POST', `/api/v1/solicitacoes-coleta/${cancellable.id}/cancelamento`, sessions.resident, {
    motivo: 'Cancelamento de verificação do fluxo',
    confirmado: true,
  });
  assert.equal(cancelled.status, 'CANCELADA');
  assert.equal(cancelled.pontosConcedidos.length, 0);

  const residentPoints = await request('GET', '/api/v1/pontuacao/lancamentos', sessions.resident);
  const collectorPoints = await request('GET', '/api/v1/pontuacao/lancamentos', sessions.collector);
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
