import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'image',
    description: 'Docker image specified as a string',
  },
  {
    depType: 'image-name',
    description: 'Docker image specified via the `name` property',
  },
  {
    depType: 'service-image',
    description: 'Docker image used as a service',
  },
  {
    depType: 'repository',
    description: 'A GitLab CI/CD component reference',
  },
] as const satisfies readonly DepTypeMetadata[];
