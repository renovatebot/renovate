import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'runtime',
    description: 'Dependencies required at runtime',
  },
  {
    depType: 'development',
    description: 'Dependencies required during development',
  },
] as const satisfies readonly DepTypeMetadata[];
