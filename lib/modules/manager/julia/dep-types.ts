import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'deps',
    description: 'A `[compat]` entry for a package in `[deps]`',
  },
  {
    depType: 'weakdeps',
    description:
      'A `[compat]` entry for a package in `[weakdeps]`, which extensions load',
  },
  {
    depType: 'test',
    description:
      'A `[compat]` entry for a package in `[extras]` that `[targets]` lists for `test`',
  },
  {
    depType: 'build',
    description:
      'A `[compat]` entry for a package in `[extras]` that `[targets]` lists for `build` only',
  },
  {
    depType: 'extras',
    description:
      'A `[compat]` entry for a package in `[extras]` that no target lists',
  },
  {
    depType: 'compat',
    description: 'A `[compat]` entry for a package that no section lists',
  },
] as const satisfies readonly DepTypeMetadata[];
