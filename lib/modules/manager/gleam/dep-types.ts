import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'dependencies',
    description: 'Listed under `dependencies`',
  },
  {
    depType: 'devDependencies',
    description: 'Listed under `dev-dependencies`',
  },
] as const satisfies readonly DepTypeMetadata[];

export type GleamDepType = (typeof knownDepTypes)[number]['depType'];
