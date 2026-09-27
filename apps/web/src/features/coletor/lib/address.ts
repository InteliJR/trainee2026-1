import type { CollectorAddress } from '../api';

export const formatAddress = (a: CollectorAddress): string => `${a.street}, ${a.number}`;
export const formatDistrict = (a: CollectorAddress): string => `${a.district}, ${a.city}`;
