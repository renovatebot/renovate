import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'requires',
    description: 'Listed under `requires`',
  },
  {
    depType: 'env_run_base',
    description: 'Listed under `[env_run_base].deps`',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Named environments produce dynamic `depType` values in the form `env.<name>`, where `<name>` is the environment name.';
