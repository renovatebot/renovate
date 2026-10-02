import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
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
  {
    depType: 'install',
    description:
      'A system package manager was used to install a package, for instance via `RUN apk add ...`',
  },
] as const satisfies readonly DepTypeMetadata[];
