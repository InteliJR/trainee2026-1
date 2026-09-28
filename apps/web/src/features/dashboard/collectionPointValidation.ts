import type { CollectionPointInput, CollectionPointKind, LocalCollectionPoint } from './collectionPointsApi';

export interface CollectionPointFormValues {
  nome: string;
  tipo: CollectionPointKind;
  latitude: string;
  longitude: string;
  circuito: string;
  descricao: string;
  ativo: boolean;
}

export type CollectionPointFormErrors = Partial<Record<keyof CollectionPointFormValues, string>>;

export const EMPTY_POINT_FORM: CollectionPointFormValues = {
  nome: '',
  tipo: 'ADICIONAL',
  latitude: '',
  longitude: '',
  circuito: '1',
  descricao: '',
  ativo: true,
};

export function formFromPoint(point: LocalCollectionPoint): CollectionPointFormValues {
  return {
    nome: point.nome,
    tipo: point.tipo,
    latitude: String(point.coordenadas.latitude),
    longitude: String(point.coordenadas.longitude),
    circuito: String(point.circuito),
    descricao: point.descricao ?? '',
    ativo: point.ativo,
  };
}

export function validateCollectionPointForm(values: CollectionPointFormValues): CollectionPointFormErrors {
  const errors: CollectionPointFormErrors = {};
  const name = values.nome.trim();
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);
  const circuit = Number(values.circuito);
  if (name.length < 2) errors.nome = 'Informe um nome com pelo menos 2 caracteres.';
  if (name.length > 120) errors.nome = 'Use no máximo 120 caracteres.';
  if (values.latitude.trim() === '' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Informe uma latitude entre -90 e 90.';
  }
  if (values.longitude.trim() === '' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Informe uma longitude entre -180 e 180.';
  }
  if (values.circuito.trim() === '' || !Number.isInteger(circuit) || circuit < 1) {
    errors.circuito = 'Informe um circuito inteiro maior ou igual a 1.';
  }
  if (values.descricao.length > 500) errors.descricao = 'Use no máximo 500 caracteres.';
  return errors;
}

export function pointInputFromForm(values: CollectionPointFormValues): CollectionPointInput {
  return {
    nome: values.nome.trim(),
    tipo: values.tipo,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    circuito: Number(values.circuito),
    descricao: values.descricao.trim() || undefined,
    ativo: values.ativo,
  };
}
