import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'repository',
    description: 'Prek hook repository reference',
  },
  {
    depType: 'pre-commit-node',
    description: 'Node.js additional dependency for a prek hook',
  },
  {
    depType: 'pre-commit-python',
    description: 'Python additional dependency for a prek hook',
  },
  {
    depType: 'pre-commit-golang',
    description: 'Go additional dependency for a prek hook',
  },
] as const satisfies readonly DepTypeMetadata[];
