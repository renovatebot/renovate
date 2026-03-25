import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'syntax',
    description:
      'The `# syntax=` parser directive at the top of the Dockerfile',
  },
  {
    depType: 'stage',
    description: 'An intermediate `FROM` instruction in a multi-stage build',
  },
  {
    depType: 'final',
    description:
      'The last `FROM` instruction in the Dockerfile (the final build stage)',
  },
];

export type DockerfileDepType = (typeof knownDepTypes)[number]['depType'];
