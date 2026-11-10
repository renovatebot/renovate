import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'HelmChart',
    description: 'Helm chart dependency in vendir configuration',
  },
  {
    depType: 'GitSource',
    description: 'Git reference-based source',
  },
  {
    depType: 'GithubRelease',
    description: 'GitHub release-based source',
  },
  {
    depType: 'HttpSource',
    description: 'HTTP-based source',
  },
] as const satisfies readonly DepTypeMetadata[];
