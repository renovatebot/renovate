import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'plugin',
    description: 'TFLint plugin sourced from GitHub Releases',
  },
] as const satisfies readonly DepTypeMetadata[];
