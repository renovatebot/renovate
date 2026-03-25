import type { DepTypeMetadata } from '../types.ts';

/**
 * sbt depType values are dynamic: the `plugin` value is hardcoded for
 * `addSbtPlugin`/`addCompilerPlugin`, but other values come from the
 * classifier or configuration string in the build file (e.g. `% "test"`).
 * This list enumerates common known values for documentation purposes.
 */
export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'plugin',
    description:
      'An sbt plugin added via `addSbtPlugin` or `addCompilerPlugin`',
  },
];

export const supportsDynamicDepTypesNote =
  'Other `depType` values are extracted dynamically from the classifier or configuration string in the build file (e.g. `% "test"`, `% Provided`, `classifier "sources"`).';
