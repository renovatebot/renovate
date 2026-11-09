import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'tools',
    description: 'A tool defined under the top-level `[tools]` table',
  },
  {
    depType: 'include',
    description:
      'A remote configuration file (`git::` or `oci::`) referenced in the top-level `include` array',
  },
  {
    depType: 'task-include',
    description:
      'A remote task source (`git::` or `oci::`) referenced in the `[task_config] includes` array',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Tools defined under `tasks.<name>.tools` produce dynamic `depType` values in the form `task-<name>-tools`, and remote `git::` task files defined in `tasks.<name>.file` produce `task-<name>-file`, where `<name>` is the task name (e.g. `task-lint-tools`, `task-build-file`).';
