import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'git_repo',
    description: 'Git repository reference in a Fleet GitRepo manifest',
  },
  {
    depType: 'fleet',
    description: 'Helm chart reference in a Fleet deployment',
  },
];

export type FleetDepType = (typeof knownDepTypes)[number]['depType'];
