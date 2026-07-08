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
  DependenciesFileGroup,
  DependenciesFilePackage,
  LockFileDependency,
  PaketManagerData,
} from './types.ts';

function findLockedDependency(
  dependencies: LockFileDependency[],
  group: DependenciesFileGroup,
  pkg: DependenciesFilePackage,
): LockFileDependency | undefined {
  return dependencies.find(
    (d) =>
      d.groupName.toUpperCase() === group.groupName.toUpperCase() &&
      d.packageName.toUpperCase() === pkg.name.toUpperCase(),
  );
}

function convertToPackageDependency(
  dependencies: LockFileDependency[],
  group: DependenciesFileGroup,
  pkg: DependenciesFilePackage,
): PackageDependency<PaketManagerData> {
  const lockedDependency = findLockedDependency(dependencies, group, pkg);

  const dep: PackageDependency<PaketManagerData> = {
    depType: 'dependencies',
    depName: lockedDependency?.packageName ?? pkg.name,
    datasource: NugetDatasource.id,
    managerData: { group: group.groupName },
  };

  if (group.sources.length) {
    dep.registryUrls = [...new Set(group.sources)];
  }

  if (lockedDependency) {
    dep.lockedVersion = lockedDependency.version;
  }

  if (pkg.versionConstraint) {
    // Paket constraint syntax cannot be evaluated without a dedicated versioning
    // module: bare `1.2.3` means an exact pin in Paket, while nuget versioning
    // treats it as a floor (>= 1.2.3). Once a paket versioning module exists,
    // set it in `defaultConfig.versioning` and drop this skipReason - lookup and
    // autoReplace then handle constrained updates without further manager changes.
    dep.currentValue = pkg.versionConstraint;
    dep.skipReason = 'unsupported-version';
  } else if (!lockedDependency) {
    dep.skipReason = 'unspecified-version';
  }

  return dep;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`paket.extractPackageFile(${packageFile})`);

  const lockFileName = getSiblingFileName(packageFile, 'paket.lock');
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!lockFileContent) {
    logger.debug(`Could not find paket lock file ${lockFileName}`);
  }

  const parsedPackageFile = parseDependenciesFile(content);
  const parsedLockFile = lockFileContent ? parseLockFile(lockFileContent) : [];

  const deps: PackageDependency[] = parsedPackageFile.groups.flatMap((group) =>
    group.nugetPackages.map((pkg) =>
      convertToPackageDependency(parsedLockFile, group, pkg),
    ),
  );
  if (!deps.length && !lockFileContent) {
    return null;
  }

  const res: PackageFileContent = { deps };
  if (lockFileContent) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
