import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'toolchain',
    description: 'Rust toolchain version',
  },
] as const satisfies readonly DepTypeMetadata[];
