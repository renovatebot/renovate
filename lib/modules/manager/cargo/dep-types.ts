import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'dependencies',
    description:
      'Listed under `[dependencies]` or `[target.<cfg>.dependencies]`',
  },
  {
    depType: 'dev-dependencies',
    description:
      'Listed under `[dev-dependencies]` or `[target.<cfg>.dev-dependencies]`',
  },
  {
    depType: 'build-dependencies',
    description:
      'Listed under `[build-dependencies]` or `[target.<cfg>.build-dependencies]`',
  },
  {
    depType: 'workspace.dependencies',
    description: 'Listed under `[workspace.dependencies]`',
  },
] as const satisfies readonly DepTypeMetadata[];
