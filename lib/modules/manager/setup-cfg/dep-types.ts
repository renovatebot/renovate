import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'install',
    description:
      'Listed under `install_requires` in the `[options]` section of `setup.cfg`',
  },
  {
    depType: 'setup',
    description:
      'Listed under `setup_requires` in the `[options]` section of `setup.cfg`',
  },
  {
    depType: 'test',
    description:
      'Listed under `tests_require` in the `[options]` section of `setup.cfg`',
  },
  {
    depType: 'extra',
    description:
      'Listed under the `[options.extras_require]` section of `setup.cfg`',
  },
];

export type SetupCfgDepType = (typeof knownDepTypes)[number]['depType'];
