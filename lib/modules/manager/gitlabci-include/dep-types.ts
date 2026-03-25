import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'repository',
    description:
      'GitLab project repository reference in a CI/CD `include` statement',
  },
];

export type GitlabciIncludeDepType = (typeof knownDepTypes)[number]['depType'];
