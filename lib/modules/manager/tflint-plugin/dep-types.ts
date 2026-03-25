import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'plugin',
    description: 'TFLint plugin sourced from GitHub Releases',
  },
];

export type TflintPluginDepType = (typeof knownDepTypes)[number]['depType'];
