import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
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
  {
    depType: 'ClusterPromotion',
    description: 'A Sveltos `ClusterPromotion` resource',
  },
] as const satisfies readonly DepTypeMetadata[];
