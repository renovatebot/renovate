import { logger } from '../../logger';
import { get } from '../../versioning';
import {
  PackageDependency,
  PackageFile,
  ExtractPackageFileConfig,
} from '../common';
import * as semverVersioning from '../../versioning/semver';
import { DATASOURCE_NUGET } from '../../constants/data-binary-source';

export function extractPackageFile({
  fileContent,
  fileName,
  config = {},
}: ExtractPackageFileConfig): PackageFile {
  logger.trace(`nuget.extractPackageFile(${fileName})`);
  const { isVersion } = get(config.versioning || semverVersioning.id);
  const deps: PackageDependency[] = [];

  let lineNumber = 0;
  for (const line of fileContent.split('\n')) {
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
        datasource: DATASOURCE_NUGET,
      };
      if (!isVersion(currentValue)) {
        dep.skipReason = 'not-version';
      }
      deps.push(dep);
    }
    lineNumber += 1;
  }
  return { deps };
}
