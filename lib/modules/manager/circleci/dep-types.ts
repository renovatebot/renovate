import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'orb',
    description: 'CircleCI orb reference',
  },
  {
    depType: 'docker',
    description: 'Docker image in executor/job configuration',
  },
] as const satisfies readonly DepTypeMetadata[];
