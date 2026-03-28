import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'install',
    description: 'Listed under `install_requires` in the `[options]` section',
  },
  {
    depType: 'setup',
    description: 'Listed under `setup_requires` in the `[options]` section',
  },
  {
    depType: 'test',
    description: 'Listed under `tests_require` in the `[options]` section',
  },
  {
    depType: 'extra',
    description: 'Listed under the `[options.extras_require]` section',
  },
] as const satisfies readonly DepTypeMetadata[];

export type SetupCfgDepType = (typeof knownDepTypes)[number]['depType'];
