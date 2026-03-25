import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'orb',
    description: 'CircleCI orb reference',
  },
  {
    depType: 'docker',
    description: 'Docker image in executor/job configuration',
  },
];

export type CircleciDepType = (typeof knownDepTypes)[number]['depType'];
