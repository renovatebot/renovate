import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'template',
    description: 'Copier project template source',
  },
];

export type CopierDepType = (typeof knownDepTypes)[number]['depType'];
