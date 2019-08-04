import { logger } from '../../logger';
import { get } from '../../versioning';
import { PackageDependency, ExtractConfig, PackageFile } from '../common';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig = {}
): PackageFile {
  logger.trace(`nuget.extractPackageFile(${packageFile})`);
  const { isVersion } = get(config.versionScheme || 'semver');
  const deps: PackageDependency[] = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(
      /<PackageReference.*Include\s*=\s*"([^"]+)".*Version\s*=\s*"([^"]+)"/
    );
    if (match) {
      const depName = match[1];
      const currentValue = match[2];
      const dep: PackageDependency = {
        depType: 'nuget',
        depName,
        currentValue,
        managerData: { lineNumber },
        datasource: 'nuget',
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
