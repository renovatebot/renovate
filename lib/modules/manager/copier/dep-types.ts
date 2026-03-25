import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'template',
    description: 'Copier project template source from `.copier-answers.yaml`',
  },
];

export type CopierDepType = (typeof knownDepTypes)[number]['depType'];
