import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'build_requires',
    description:
      'A build-time dependency declared in `[build_requires]` or `build_requirements()`',
  },
  {
    depType: 'python_requires',
    description:
      'A Python-based Conan recipe dependency declared via `python_requires`',
  },
  {
    depType: 'requires',
    description:
      'A runtime dependency declared in `[requires]` or `requirements()`',
  },
] as const satisfies readonly DepTypeMetadata[];

export type ConanDepType = (typeof knownDepTypes)[number]['depType'];
