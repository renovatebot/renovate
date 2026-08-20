import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'tekton-annotation',
    description:
      'Tekton resource referenced via an annotation (e.g. GitHub release or git tag URL)',
  },
  {
    depType: 'tekton-bundle',
    description: 'Tekton Bundle OCI image reference',
  },
  {
    depType: 'tekton-step-image',
    description:
      'Container image used in a Tekton step, sidecar, or step template',
  },
] as const satisfies readonly DepTypeMetadata[];
