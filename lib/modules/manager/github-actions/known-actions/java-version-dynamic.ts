import { z } from 'zod/v4';
import { JavaVersionDatasource } from '../../../datasource/java-version/index.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import { parseValue } from './utils.ts';

// Distributions whose version numbering we can reliably track via the
// java-version datasource (which sources releases from Adoptium/Eclipse
// Temurin). Other distributions may not follow the same release cadence
// or versioning, so we don't attempt to track them.
const supportedJavaDistributions = new Set(['temurin', 'adopt']);

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

      return [{ packageName, ...parseValue(version) }];
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
