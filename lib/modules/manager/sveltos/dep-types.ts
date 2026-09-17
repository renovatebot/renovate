import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'ClusterProfile',
    description:
      'A Sveltos [`ClusterProfile`](https://projectsveltos.github.io/sveltos/addons/clusterprofile/) resource',
  },
  {
    depType: 'Profile',
    description:
      'A Sveltos [`Profile`](https://projectsveltos.github.io/sveltos/addons/profile/) resource',
  },
  {
    depType: 'EventTrigger',
    description:
      'A Sveltos [`EventTrigger`](https://projectsveltos.github.io/sveltos/events/addon_event_deployment/#eventtrigger) resource',
  },
  {
    depType: 'ClusterPromotion',
    description:
      'A Sveltos [`ClusterPromotion`](https://projectsveltos.github.io/sveltos/addons/clusterpromotion/) resource',
  },
] as const satisfies readonly DepTypeMetadata[];
