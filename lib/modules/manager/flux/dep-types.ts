import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'HelmChart',
    description:
      'Helm chart from a `HelmRelease` or `HelmChart` resource, or an `OCIRepository` selecting the Helm chart layer',
  },
] as const satisfies readonly DepTypeMetadata[];
