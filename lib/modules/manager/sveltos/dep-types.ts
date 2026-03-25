import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'ClusterProfile',
    description: 'A Sveltos `ClusterProfile` resource',
  },
  {
    depType: 'Profile',
    description: 'A Sveltos `Profile` resource',
  },
  {
    depType: 'EventTrigger',
    description: 'A Sveltos `EventTrigger` resource',
  },
];

export type SveltosDepType = (typeof knownDepTypes)[number]['depType'];
