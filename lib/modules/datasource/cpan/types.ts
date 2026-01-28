import type { Release } from '../types.ts';

export interface CpanRelease extends Release {
  distribution: string;
}
