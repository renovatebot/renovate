import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'project.dependencies',
    description:
      'A dependency from the inline `[script.dependencies]` metadata (parsed as PEP 508)',
  },
];

export type Pep723DepType = (typeof knownDepTypes)[number]['depType'];
