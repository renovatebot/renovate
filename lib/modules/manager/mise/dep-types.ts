import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'tools',
    description: 'A tool defined under the top-level `[tools]` table',
  },
  {
    depType: 'task-tools',
    description: 'A tool defined under `tasks.*.tools`',
  },
] as const satisfies readonly DepTypeMetadata[];
