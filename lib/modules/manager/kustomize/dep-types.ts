import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'Kustomization',
    description: 'Kustomization resource referencing remote bases or images',
  },
  {
    depType: 'Component',
    description:
      'Kustomize Component resource referencing remote bases or images',
  },
  {
    depType: 'HelmChart',
    description: 'Helm chart embedded in a kustomization file via `helmCharts`',
  },
] as const satisfies readonly DepTypeMetadata[];
