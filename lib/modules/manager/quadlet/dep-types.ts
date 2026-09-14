import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'image',
    description: 'Container image referenced in a Quadlet unit file',
  },
] as const satisfies readonly DepTypeMetadata[];
