import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'feature',
    description:
      'A Dev Container Feature reference (e.g. `ghcr.io/devcontainers/features/node:1`)',
  },
  {
    depType: 'image',
    description:
      'The base Docker image specified in the `image` field of devcontainer.json',
  },
] as const satisfies readonly DepTypeMetadata[];
