import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'docker',
    description:
      'A Docker image reference in a `container:` field in Azure Pipelines',
  },
  {
    depType: 'gitTags',
    description:
      'A Git repository resource referenced by tag (e.g. `refs/tags/v1.0.0`)',
  },
] as const satisfies readonly DepTypeMetadata[];

export type AzurePipelinesDepType = (typeof knownDepTypes)[number]['depType'];
