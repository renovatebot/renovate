import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'bitbucket-tags',
    description: 'A Bitbucket pipe reference resolved via Bitbucket tags',
  },
  {
    depType: 'docker',
    description:
      'A Docker image used as the build image or in a service definition',
  },
];

export type BitbucketPipelinesDepType =
  (typeof knownDepTypes)[number]['depType'];
