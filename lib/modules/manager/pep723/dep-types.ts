import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'requires-python',
    description:
      'The `requires-python` constraint from the inline script metadata',
  },
  {
    depType: 'project.dependencies',
    description:
      'A dependency from the inline `[script.dependencies]` metadata (parsed as PEP 508)',
  },
] as const satisfies readonly DepTypeMetadata[];
