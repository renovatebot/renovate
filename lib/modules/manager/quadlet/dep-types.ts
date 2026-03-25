import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'image',
    description: 'Container image referenced in a Quadlet unit file',
  },
];

export type QuadletDepType = (typeof knownDepTypes)[number]['depType'];
