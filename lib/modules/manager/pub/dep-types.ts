import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'dependencies',
    description: 'Listed under `dependencies`',
  },
  {
    depType: 'dev_dependencies',
    description: 'Listed under `dev_dependencies`',
  },
];

export type PubDepType = (typeof knownDepTypes)[number]['depType'];
