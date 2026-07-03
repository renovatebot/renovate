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
  PaketManagerData,
} from './types.ts';

function searchPackageVersion(
  dependencies: LockFileDependency[],
  group: DependenciesFileGroup,
  p: DependenciesFilePackage,
): LockFileDependency | undefined {
  return dependencies.find(
    (d) =>
      d.groupName.toUpperCase() === group.groupName.toUpperCase() &&
      d.packageName.toUpperCase() === p.name.toUpperCase(),
  );
}

function convertToPackageDependency(
  dependencies: LockFileDependency[],
  group: DependenciesFileGroup,
  p: DependenciesFilePackage,
): PackageDependency<PaketManagerData> {
  const lockVersion = searchPackageVersion(dependencies, group, p);

  const version = lockVersion?.version;
  const name = lockVersion?.packageName ?? p.name;
  const dep: PackageDependency<PaketManagerData> = {
    depType: 'dependencies',
    depName: name,
    currentVersion: version,
    datasource: NugetDatasource.id,
    lockedVersion: version,
    managerData: { group: group.groupName },
  };

  if (p.versionConstraint) {
    // Version constraints from paket.dependencies can't be evaluated without a paket versioning module, so such dependencies are skipped for now.
    dep.currentValue = p.versionConstraint;
    dep.skipReason = 'unsupported-version';
  }

  return dep;
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
): Promise<PackageFileContent | null> {
  logger.trace(`paket.extractPackageFile(${packageFile})`);

  const lockFileName = getSiblingFileName(packageFile, 'paket.lock');
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!lockFileContent) {
    logger.debug({ lockFileName }, 'Could not find paket lock file');
    return null;
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
