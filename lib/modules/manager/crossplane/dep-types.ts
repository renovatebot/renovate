import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'provider',
    description: 'A Crossplane Provider package',
  },
  {
    depType: 'configuration',
    description: 'A Crossplane Configuration package',
  },
  {
    depType: 'function',
    description: 'A Crossplane Function package',
  },
];

export type CrossplaneDepType = (typeof knownDepTypes)[number]['depType'];
