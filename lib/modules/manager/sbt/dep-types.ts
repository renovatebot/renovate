import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'plugin',
    description:
      'An sbt plugin added via `addSbtPlugin` or `addCompilerPlugin`',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Other `depType` values are extracted dynamically from the classifier or configuration string in the build file (e.g. `% "test"`, `% Provided`, `classifier "sources"`).';
