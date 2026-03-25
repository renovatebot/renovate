import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'prod',
    description: 'A production dependency in `mix.exs`',
  },
  {
    depType: 'dev',
    description:
      'A development-only dependency in `mix.exs` (restricted via `only:`)',
  },
];

export type MixDepType = (typeof knownDepTypes)[number]['depType'];
