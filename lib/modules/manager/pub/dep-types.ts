import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'dependencies',
    description: 'Listed under `dependencies` in `pubspec.yaml`',
  },
  {
    depType: 'dev_dependencies',
    description: 'Listed under `dev_dependencies` in `pubspec.yaml`',
  },
];

export type PubDepType = (typeof knownDepTypes)[number]['depType'];
