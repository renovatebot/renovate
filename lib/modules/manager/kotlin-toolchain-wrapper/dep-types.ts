import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'toolchain',
    description: 'Kotlin Toolchain CLI version used by the wrapper scripts',
  },
] as const satisfies readonly DepTypeMetadata[];
