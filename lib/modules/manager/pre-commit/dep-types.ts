import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'repository',
    description: 'Pre-commit hook repository reference',
  },
  {
    depType: 'pre-commit-node',
    description: 'Node.js additional dependency for a pre-commit hook',
  },
  {
    depType: 'pre-commit-python',
    description: 'Python additional dependency for a pre-commit hook',
  },
  {
    depType: 'pre-commit-golang',
    description: 'Go additional dependency for a pre-commit hook',
  },
];

export type PreCommitDepType = (typeof knownDepTypes)[number]['depType'];
