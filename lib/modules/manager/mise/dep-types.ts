import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'tools',
    description: 'A tool defined under the top-level `[tools]` table',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Tools defined under `tasks.<name>.tools` produce dynamic `depType` values in the form `task-<name>-tools`, where `<name>` is the task name (e.g. `task-lint-tools`).';
