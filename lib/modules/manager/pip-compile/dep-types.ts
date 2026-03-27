import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'indirect',
    description:
      'Indirect/transitive dependency locked in the compiled requirements file, but not directly specified in source',
  },
] as const satisfies readonly DepTypeMetadata[];

export type PipCompileDepType = (typeof knownDepTypes)[number]['depType'];
