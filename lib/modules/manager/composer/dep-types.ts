import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'require',
    description: 'Production dependency from `require` section',
  },
  {
    depType: 'require-dev',
    description: 'Development dependency from `require-dev` section',
  },
];

export type ComposerDepType = (typeof knownDepTypes)[number]['depType'];
