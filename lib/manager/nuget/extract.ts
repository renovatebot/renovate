import { logger } from '../../logger';
import { get } from '../../versioning';
import { PackageDependency, ExtractConfig, PackageFile } from '../common';
import * as semverVersioning from '../../versioning/semver';
import * as datasourceNuget from '../../datasource/nuget';
import { SkipReason } from '../../types';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig = {}
): PackageFile {
  logger.trace(`nuget.extractPackageFile(${packageFile})`);
  const { isVersion } = get(config.versioning || semverVersioning.id);
  const deps: PackageDependency[] = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    /**
     * https://docs.microsoft.com/en-us/nuget/concepts/package-versioning
     * This article mentions that  Nuget 3.x and later tries to restore the lowest possible version
     * regarding to given version range.
     * 1.3.4 equals [1.3.4,)
     * Due to guarantee that an update of package version will result in its usage by the next restore + build operation,
     * only following constrained versions make sense
     * 1.3.4, [1.3.4], [1.3.4, ], [1.3.4, )
     * The update of the right boundary does not make sense regarding to the lowest version restore rule,
     * so we don't include it in the extracting regexp
     */

    const match = /<PackageReference.*Include\s*=\s*"([^"]+)".*Version\s*=\s*"(?:[[])?(?:([^"(,[\]]+)\s*(?:,\s*[)\]]|])?)"/.exec(
      line
    );
    if (match) {
      const depName = match[1];
      const currentValue = match[2];
      const dep: PackageDependency = {
        depType: 'nuget',
        depName,
        currentValue,
        managerData: { lineNumber },
        datasource: datasourceNuget.id,
      };
      if (!isVersion(currentValue)) {
        dep.skipReason = SkipReason.NotAVersion;
      }
      deps.push(dep);
    }
    lineNumber += 1;
  }
  return { deps };
}
