import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { parse as parseDependenciesFile } from './parsers/dependencies-file.ts';
import { parse as parseLockFile } from './parsers/lock-file.ts';
import type {
  DependenciesFile,
  DependenciesFileGroup,
  DependenciesFilePackage,
  LockFileDependency,
  PaketPackage,
} from './types.ts';

const searchPackageVersion = (
  dependencies: LockFileDependency[],
  group: DependenciesFileGroup,
  p: DependenciesFilePackage,
): LockFileDependency | undefined =>
  dependencies.find(
    (d) =>
      d.groupName === group.groupName &&
      d.packageName.toUpperCase() === p.name.toUpperCase(),
  );

function convertToPackageDependency(
  dependencies: LockFileDependency[],
  group: DependenciesFileGroup,
  p: DependenciesFilePackage,
): PackageDependency {
  const lockVersion = searchPackageVersion(dependencies, group, p);

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
}

function convertLockFileDependencyToPackageDependency(
  parsedPackageFile: DependenciesFile,
  parsedLockFile: LockFileDependency[],
): PackageDependency[] {
  return parsedPackageFile.groups.flatMap((group) => {
    return group.nugetPackages.map((p) => {
      return convertToPackageDependency(parsedLockFile, group, p);
    });
  });
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent<PaketPackage>> {
  logger.debug(`paket.extractPackageFile(${packageFile})`);

  const lockFileName = getSiblingFileName(packageFile, 'paket.lock');
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!lockFileContent) {
    throw new Error(`Could not to paket lock file: ${lockFileName}`);
  }

  const parsedPackageFile = parseDependenciesFile(content);
  const parsedLockFile = parseLockFile(lockFileContent);

  const deps: PackageDependency[] =
    convertLockFileDependencyToPackageDependency(
      parsedPackageFile,
      parsedLockFile,
    );

  return {
    deps,
    lockFiles: [lockFileName],
  };
}
