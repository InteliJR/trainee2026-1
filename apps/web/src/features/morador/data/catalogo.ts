/**
 * Catálogo fixo da tela de solicitação: tipos de material aceitos e turnos de retirada.
 * São opções de interface, não dados operacionais — pontos, coletas e coletores vêm sempre da API.
 */
import type { MaterialOption, ShiftOption } from '../types';

// Pontos creditados por coleta concluída. Espelha a regra da API (request.repository.ts: 100 pontos
// para morador e coletor ao concluir); se a API passar a expor a regra, esta constante deve sair.
export const POINTS_PER_COMPLETED_COLLECTION = 100;

export const materialOptions: MaterialOption[] = [
  {
    id: 'papel',
    name: 'Papel e papelão',
    helper: 'Caixas, folhas, jornais e embalagens limpas.',
    acceptedExamples: ['Caixa desmontada', 'Caderno usado', 'Jornal seco'],
  },
  {
    id: 'plastico',
    name: 'Plásticos',
    helper: 'Garrafas PET, potes e embalagens sem resíduo orgânico.',
    acceptedExamples: ['PET limpa', 'Pote de shampoo', 'Embalagem lavada'],
  },
  {
    id: 'vidro',
    name: 'Vidro',
    helper: 'Garrafas, potes e frascos embalados com segurança.',
    acceptedExamples: ['Garrafa', 'Pote de conserva', 'Frasco'],
  },
  {
    id: 'metal',
    name: 'Metal',
    helper: 'Latas, tampas e pequenas peças metálicas.',
    acceptedExamples: ['Lata de alumínio', 'Tampa metálica', 'Ferragem pequena'],
  },
  {
    id: 'eletronicos',
    name: 'Eletrônicos',
    helper: 'Cabos, carregadores, pilhas e itens pequenos.',
    acceptedExamples: ['Cabo USB', 'Carregador', 'Pilhas separadas'],
  },
  {
    id: 'oleo',
    name: 'Óleo de cozinha',
    helper: 'Óleo usado em garrafa PET bem fechada.',
    acceptedExamples: ['Garrafa PET vedada', 'Óleo filtrado', 'Recipiente limpo'],
  },
];

// Janelas de retirada; o horário de início de cada turno monta a data desejada enviada à API.
export const shiftOptions: ShiftOption[] = [
  { id: 'manha', label: 'Manhã', window: '08:00 - 12:00' },
  { id: 'tarde', label: 'Tarde', window: '13:00 - 17:00' },
  { id: 'noite', label: 'Noite', window: '18:00 - 20:00' },
];
