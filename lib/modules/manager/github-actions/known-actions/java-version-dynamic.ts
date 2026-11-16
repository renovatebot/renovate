import { z } from 'zod/v4';
import { JavaVersionDatasource } from '../../../datasource/java-version/index.ts';
import { api as semver } from '../../../versioning/semver/index.ts';
import { isPartialVersion } from '../../../versioning/semver-partial/index.ts';
import type { PackageDependency } from '../../types.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import { parsePartialValue } from './utils.ts';

// Distributions whose version numbering we can reliably track via the
// java-version datasource (which sources releases from Adoptium/Eclipse
// Temurin). Other distributions may not follow the same release cadence
// or versioning, so we don't attempt to track them.
const supportedJavaDistributions = new Set(['temurin', 'adopt']);

/**
 * Parse a `java-version` input, which per actions/setup-java' and graalvm/setup-graalvm's docs, may be a version, a semver range, an early-access version or `latest`.
 *
 * A whole version (`21`, `21.0`) keeps their precision through `semver-partial` versioning.
 *
 * Exact versions are looked up as-is.
 *
 * Other forms of versions (`21.x`, `>=21`, `21-ea`, `latest`, ...) are skipped, as we can't provide a recommended bump at this time.
 */
export function parseJavaVersion(
  version: string | undefined,
): PackageDependency {
  if (version && !isPartialVersion(version) && !semver.isVersion(version)) {
    return {
      currentValue: version,
      depType: 'uses-with',
      skipStage: 'extract',
      skipReason: 'unsupported-version',
    };
  }

  return parsePartialValue(version);
}

const SetupJavaWith: ActionSchema = z
  .object({
    distribution: z.string().optional(),
    'java-version': z.string().optional(),
    'java-package': z.string().optional(),
  })
  .transform(
    ({
      distribution,
      'java-version': version,
      'java-package': javaPackage,
    }) => {
      const packageName = javaPackage?.startsWith('jre')
        ? 'java-jre'
        : 'java-jdk';

      if (
        !distribution ||
        !supportedJavaDistributions.has(distribution.toLowerCase())
      ) {
        return [
          {
            packageName,
            depType: 'uses-with',
            skipStage: 'extract',
            skipReason: 'unsupported',
          },
        ];
      }

      return [{ packageName, ...parseJavaVersion(version) }];
    },
  );

export const javaVersionDynamicActions: Record<string, KnownActionConfig> = {
  // https://github.com/actions/setup-java
  'actions/setup-java': {
    datasource: JavaVersionDatasource.id,
    packageName: '', // determined from `distribution`/`java-package` inputs
    withSchema: SetupJavaWith,
  },
};
