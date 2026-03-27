import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'repository',
    description:
      'GitLab project repository reference in a CI/CD `include` statement',
  },
] as const satisfies readonly DepTypeMetadata[];

export type GitlabciIncludeDepType = (typeof knownDepTypes)[number]['depType'];
