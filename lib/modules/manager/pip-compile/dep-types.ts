import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'indirect',
    description:
      'Indirect/transitive dependency locked in the compiled requirements file, but not directly specified in source',
  },
];

export type PipCompileDepType = (typeof knownDepTypes)[number]['depType'];
