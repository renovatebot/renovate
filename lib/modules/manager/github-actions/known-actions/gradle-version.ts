import { GradleVersionDatasource } from '../../../datasource/gradle-version/index.ts';
import * as gradleVersioning from '../../../versioning/gradle/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

/**
 * `gradle/actions/setup-gradle` has a few `gradle-version`s that are strings used to denote another source than a specific version number, which shouldn't have an update proposed for.
 */
const GradleVersionAliases = new Set([
  'wrapper',
  'current',
  'release-candidate',
  'nightly',
  'release-nightly',
]);

export const gradleVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/gradle/actions (there is no root-level Action, only
  // subpaths such as `setup-gradle` are usable)
  'gradle/actions/setup-gradle': {
    datasource: GradleVersionDatasource.id,
    depName: 'gradle',
    packageName: 'gradle/gradle',
    versioning: gradleVersioning.id,
    withSchema: valSchema('gradle-version', (val) =>
      GradleVersionAliases.has(val),
    ),
  },
};
