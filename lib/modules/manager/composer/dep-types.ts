import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'require',
    description: 'Production dependency from `require` section',
  },
  {
    depType: 'require-dev',
    description: 'Development dependency from `require-dev` section',
  },
] as const satisfies readonly DepTypeMetadata[];

export type ComposerDepType = (typeof knownDepTypes)[number]['depType'];
