import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'prod',
    description: 'A production dependency',
  },
  {
    depType: 'dev',
    description: 'A development-only dependency (restricted via `only:`)',
  },
] as const satisfies readonly DepTypeMetadata[];

export type MixDepType = (typeof knownDepTypes)[number]['depType'];
