import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'dependencies',
    description: 'Listed under `dependencies` in `gleam.toml`',
  },
  {
    depType: 'devDependencies',
    description: 'Listed under `dev-dependencies` in `gleam.toml`',
  },
];

export type GleamDepType = (typeof knownDepTypes)[number]['depType'];
