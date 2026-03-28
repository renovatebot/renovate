import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'bitbucket-tags',
    description: 'A Bitbucket pipe reference resolved via Bitbucket tags',
  },
  {
    depType: 'docker',
    description:
      'A Docker image used as the build image or in a service definition',
  },
] as const satisfies readonly DepTypeMetadata[];

export type BitbucketPipelinesDepType =
  (typeof knownDepTypes)[number]['depType'];
