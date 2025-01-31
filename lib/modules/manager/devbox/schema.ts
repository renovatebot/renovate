import { z } from 'zod';
import { logger } from '../../../logger';
import { Jsonc } from '../../../util/schema-utils';
import { DevboxDatasource } from '../../datasource/devbox';
import * as devboxVersioning from '../../versioning/devbox';
import type { PackageDependency } from '../types';

export const DevboxSchema = z.object({
  packages: z
    .union([
      z.array(z.string()).transform((packages) =>
        packages.reduce(
          (result, pkg) => {
            const [name, version] = pkg.split('@');
            result[name] = version;
            return result;
          },
          {} as Record<string, string | undefined>,
        ),
      ),
      z.record(
        z.union([
          z.string(),
          z.object({ version: z.string() }).transform(({ version }) => version),
        ]),
      ),
    ])
    .transform((packages): PackageDependency[] =>
      Object.entries(packages)
        .map(([pkgName, pkgVer]) => getDep(pkgName, pkgVer))
        .filter((pkgDep): pkgDep is PackageDependency => !!pkgDep),
    ),
});

export const DevboxFileSchema = Jsonc.pipe(DevboxSchema);

function getDep(
  packageName: string,
  version: string | undefined,
): PackageDependency {
  const dep = {
    depName: packageName,
    currentValue: version,
    datasource: DevboxDatasource.id,
    packageName,
  };
  if (!dep.currentValue) {
    logger.trace(
      { packageName },
      'Skipping devbox dependency with no version in devbox JSON file.',
    );
    return {
      ...dep,
      skipReason: 'not-a-version',
    };
  }
  if (!devboxVersioning.api.isValid(dep.currentValue)) {
    logger.trace(
      { packageName },
      'Skipping invalid devbox dependency in devbox JSON file.',
    );
    return {
      ...dep,
      skipReason: 'invalid-version',
    };
  }
  return dep;
}
