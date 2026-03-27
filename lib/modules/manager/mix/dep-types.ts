import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'prod',
    description: 'A production dependency',
  },
  {
    depType: 'dev',
    description: 'A development-only dependency (restricted via `only:`)',
  },
];

export type MixDepType = (typeof knownDepTypes)[number]['depType'];
