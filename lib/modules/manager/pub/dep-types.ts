import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'dependencies',
    description: 'Listed under `dependencies`',
  },
  {
    depType: 'dev_dependencies',
    description: 'Listed under `dev_dependencies`',
  },
] as const satisfies readonly DepTypeMetadata[];
