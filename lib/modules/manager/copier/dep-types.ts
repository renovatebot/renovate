import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'template',
    description: 'Copier project template source',
  },
] as const satisfies readonly DepTypeMetadata[];
