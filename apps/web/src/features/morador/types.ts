import type { Point, RequestStatus } from '@ecorota/shared';

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

export interface StatusTimelineItem {
  status: RequestStatus;
  label: string;
  occurredAt: string | null;
  description: string;
}

export interface ResidentCollectionRequest {
  id: string;
  // Referência usada pelo backend e pelo Socket.IO para identificar a solicitação.
  externalReference?: string;
  protocol: string;
  materialId: MaterialCategory;
  materialName: string;
  pointName: string;
  pointAddress: string;
  neighborhood: string;
  scheduledDate: string;
  shiftLabel: string;
  shiftWindow: string;
  status: RequestStatus;
  collectorName: string | null;
  collectorPhone: string | null;
  estimatedArrival: string | null;
  pointsPreview: number;
  timeline: StatusTimelineItem[];
}
