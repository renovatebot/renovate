import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'dependencies',
    description: 'Listed under `dependencies`',
  },
  {
    depType: 'devDependencies',
    description: 'Listed under `dev-dependencies`',
  },
];

export type GleamDepType = (typeof knownDepTypes)[number]['depType'];
