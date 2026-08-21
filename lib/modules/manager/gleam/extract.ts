import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { getSiblingFileName, localPathExists } from '../../../util/fs/index.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';
import { api as versioning } from '../../versioning/hex/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { extractLockFileVersions } from './locked-version.ts';
import { GleamToml } from './schema.ts';

const dependencySections = ['dependencies', 'dev-dependencies'] as const;

// map gleam.toml section keys to standard renovate depType's
// this allows us to leverage renovate built-in configurations and presets
function mapSectionKey(sectionKey: string): string {
  switch (sectionKey) {
    case 'dev-dependencies':
      return 'devDependencies';
    default:
      return sectionKey;
  }
}

function toPackageDep({
  name,
  sectionKey,
  version,
}: {
  name: string;
  sectionKey: string;
  version: string;
}): PackageDependency {
  return {
    depName: name,
    depType: mapSectionKey(sectionKey),
    datasource: HexDatasource.id,
    currentValue: version,
  };
}

function toPackageDeps({
  deps,
  sectionKey,
}: {
  deps?: Record<string, string>;
  sectionKey: string;
}): PackageDependency[] {
  return Object.entries(deps ?? {}).map(([name, version]) =>
    toPackageDep({ name, sectionKey, version }),
  );
}

function extractGleamTomlDeps(gleamToml: GleamToml): PackageDependency[] {
  return dependencySections.flatMap((sectionKey) =>
    toPackageDeps({
      deps: gleamToml[sectionKey],
      sectionKey,
    }),
  );
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  const result = GleamToml.safeParse(content);
  if (!result.success) {
    logger.debug(
      { err: result.error, packageFile },
      'Error parsing Gleam package file content',
    );
    return null;
  }

  const deps = extractGleamTomlDeps(result.data);
  if (!deps.length) {
    logger.debug(`No dependencies found in Gleam package file ${packageFile}`);
    return null;
  }

  const packageFileContent: PackageFileContent = { deps };
  const lockFileName = getSiblingFileName(packageFile, 'manifest.toml');

  const lockFileExists = await localPathExists(lockFileName);
  if (!lockFileExists) {
    logger.debug(`Lock file ${lockFileName} does not exist.`);
    return packageFileContent;
  }

  const versionsByPackage = await extractLockFileVersions(lockFileName);
  if (!versionsByPackage) {
    return packageFileContent;
  }

  packageFileContent.lockFiles = [lockFileName];

  for (const dep of packageFileContent.deps) {
    const packageName = dep.depName!;
    const versions = coerceArray(versionsByPackage.get(packageName));
    const lockedVersion = versioning.getSatisfyingVersion(
      versions,
      dep.currentValue!,
    );
    if (lockedVersion) {
      dep.lockedVersion = lockedVersion;
    } else {
      logger.debug(
        `No locked version found for package ${dep.depName} in the range of ${dep.currentValue}.`,
      );
    }
  }
  return packageFileContent;
}
