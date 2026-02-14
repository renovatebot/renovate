import { logger } from '../../../logger/index.ts';
import { getSiblingFileName } from '../../../util/fs/index.ts';
import { getFiles } from '../../../util/git/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { parse as parseDependenciesFile } from './parsers/dependencies-file.ts';
import { parse as parseLockFile } from './parsers/lock-file.ts';
import type { PaketPackage } from './types.ts';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent<PaketPackage>> {
  logger.debug(`paket.extractPackageFile(${packageFile})`);

  const lockFileName = getSiblingFileName(packageFile, 'paket.lock');
  const lockFileContentMap = await getFiles([lockFileName]);
  const lockFileContent = lockFileContentMap[lockFileName];
  if (!lockFileContent) {
    throw new Error(`Could not to paket lock file: ${lockFileName}`);
  }

  const parsedPackageFile = parseDependenciesFile(content);
  const parsedLockFile = parseLockFile(lockFileContent);

  const deps: PackageDependency[] = parsedPackageFile.groups.flatMap(
    (group) => {
      return group.nugetPackages.map((p) => {
        const lockVersion = parsedLockFile.find(
          (d) =>
            d.groupName === group.groupName &&
            d.packageName.toUpperCase() === p.name.toUpperCase(),
        );

        const version = lockVersion?.version;
        const name = lockVersion?.packageName ?? p.name;
        return {
          depType: 'dependencies',
          depName: name,
          currentVersion: version,
          datasource: NugetDatasource.id,
          rangeStrategy: 'update-lockfile',
          lockedVersion: version,
        };
      });
    },
  );

  return {
    deps,
    lockFiles: [lockFileName],
  };
}
