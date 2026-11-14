import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'dependencies',
    description: 'Standard package dependencies declared via `requires`',
  },
  {
    depType: 'taskRequires',
    description: 'Task-scoped package dependencies declared via `taskRequires`',
  },
  {
    depType: 'compiler',
    description:
      'Nim compiler version requirement (`nim`, `nimrod`, or `compiler`)',
  },
] as const satisfies readonly DepTypeMetadata[];
