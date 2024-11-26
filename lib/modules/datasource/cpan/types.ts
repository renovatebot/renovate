import type { Release } from '../types';

export interface CpanRelease extends Release {
  distribution: string;
}
