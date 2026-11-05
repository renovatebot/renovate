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
    depType: 'extras',
    description:
      'A `[compat]` entry for a package in `[extras]`, which `[targets]` uses for tests or builds',
  },
  {
    depType: 'compat',
    description: 'A `[compat]` entry for a package that no section lists',
  },
] as const satisfies readonly DepTypeMetadata[];
