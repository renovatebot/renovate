import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'tool-constraint',
    description: 'A `tool` that Containerbase supports.',
  },
  {
    depType: 'constraint',
    description:
      'Additional constraints that can be specified for some Managers, but are **not** tools that Containerbase supports.',
  },
] as const satisfies readonly DepTypeMetadata[];
