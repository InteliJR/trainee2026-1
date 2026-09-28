import type { CollectionPoint, MaterialOption, ShiftOption } from '../types';

export const materialOptions: MaterialOption[] = [
  {
    id: 'papel',
    name: 'Papel e papelão',
    helper: 'Caixas, folhas, jornais e embalagens limpas.',
    points: 12,
    acceptedExamples: ['Caixa desmontada', 'Caderno usado', 'Jornal seco'],
  },
  {
    id: 'plastico',
    name: 'Plásticos',
    helper: 'Garrafas PET, potes e embalagens sem resíduo orgânico.',
    points: 14,
    acceptedExamples: ['PET limpa', 'Pote de shampoo', 'Embalagem lavada'],
  },
  {
    id: 'vidro',
    name: 'Vidro',
    helper: 'Garrafas, potes e frascos embalados com segurança.',
    points: 18,
    acceptedExamples: ['Garrafa', 'Pote de conserva', 'Frasco'],
  },
  {
    id: 'metal',
    name: 'Metal',
    helper: 'Latas, tampas e pequenas peças metálicas.',
    points: 16,
    acceptedExamples: ['Lata de aluminio', 'Tampa metálica', 'Ferragem pequena'],
  },
  {
    id: 'eletronicos',
    name: 'Eletrônicos',
    helper: 'Cabos, carregadores, pilhas e itens pequenos.',
    points: 24,
    acceptedExamples: ['Cabo USB', 'Carregador', 'Pilhas separadas'],
  },
  {
    id: 'oleo',
    name: 'Óleo de cozinha',
    helper: 'Óleo usado em garrafa PET bem fechada.',
    points: 20,
    acceptedExamples: ['Garrafa PET vedada', 'Óleo filtrado', 'Recipiente limpo'],
  },
];

export const collectionPoints: CollectionPoint[] = [
  {
    id: 'ponto-vila-mariana',
    name: 'Ecoponto Vila Mariana',
    kind: 'habitual',
    coordinates: [-46.6355, -23.5898],
    circuit: 1,
    demand: { pending: 5, assigned: 2, in_service: 1, completed: 38, cancelled: 1 },
    address: 'Rua Madre Cabrini, 210',
    neighborhood: 'Vila Mariana',
    distanceKm: 1.2,
    accepts: ['papel', 'plastico', 'vidro', 'metal', 'oleo'],
    nextAvailability: 'Hoje a tarde',
  },
  {
    id: 'ponto-pinheiros',
    name: 'Cooperativa Pinheiros',
    kind: 'habitual',
    coordinates: [-46.6901, -23.5654],
    circuit: 2,
    demand: { pending: 3, assigned: 1, in_service: 0, completed: 26, cancelled: 2 },
    address: 'Rua dos Pinheiros, 890',
    neighborhood: 'Pinheiros',
    distanceKm: 2.8,
    accepts: ['papel', 'plastico', 'metal', 'eletronicos'],
    nextAvailability: 'Amanhã de manhã',
  },
  {
    id: 'ponto-bela-vista',
    name: 'Ponto Verde Bela Vista',
    kind: 'additional',
    coordinates: [-46.6477, -23.5614],
    circuit: 1,
    demand: { pending: 8, assigned: 3, in_service: 1, completed: 42, cancelled: 0 },
    address: 'Av. Brigadeiro Luis Antonio, 1320',
    neighborhood: 'Bela Vista',
    distanceKm: 3.1,
    accepts: ['papel', 'plastico', 'vidro', 'metal'],
    nextAvailability: 'Hoje a noite',
  },
  {
    id: 'ponto-mooca',
    name: 'Central Recicla Mooca',
    kind: 'habitual',
    coordinates: [-46.5978, -23.5582],
    circuit: 3,
    demand: { pending: 2, assigned: 2, in_service: 0, completed: 31, cancelled: 1 },
    address: 'Rua da Mooca, 2480',
    neighborhood: 'Mooca',
    distanceKm: 4.5,
    accepts: ['plastico', 'metal', 'oleo', 'eletronicos'],
    nextAvailability: 'Sexta a tarde',
  },
];

export const shiftOptions: ShiftOption[] = [
  { id: 'manha', label: 'Manhã', window: '08:00 - 12:00', slots: 4 },
  { id: 'tarde', label: 'Tarde', window: '13:00 - 17:00', slots: 6 },
  { id: 'noite', label: 'Noite', window: '18:00 - 20:00', slots: 2 },
];

export const neighborhoodFilters = ['Todos', 'Vila Mariana', 'Pinheiros', 'Bela Vista', 'Mooca'] as const;
