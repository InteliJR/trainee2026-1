import type { Point } from '@ecorota/shared';

export type MaterialCategory =
  | 'papel'
  | 'plastico'
  | 'vidro'
  | 'metal'
  | 'eletronicos'
  | 'oleo';

export interface MaterialOption {
  id: MaterialCategory;
  name: string;
  helper: string;
  points: number;
  acceptedExamples: string[];
}

export interface CollectionPoint extends Point {
  address: string;
  neighborhood: string;
  distanceKm: number;
  accepts: MaterialCategory[];
  nextAvailability: string;
}

export type Shift = 'manha' | 'tarde' | 'noite';

export interface ShiftOption {
  id: Shift;
  label: string;
  window: string;
  slots: number;
}

export interface ResidentRequestDraft {
  materialId: MaterialCategory | null;
  pointId: string | null;
  desiredDate: string;
  shift: Shift | null;
  notes: string;
}
