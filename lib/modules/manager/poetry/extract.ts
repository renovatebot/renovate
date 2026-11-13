import { logger } from '../../../logger/index.ts';
import { filterMap } from '../../../util/filter-map.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { Result } from '../../../util/result.ts';
import { massage as massageToml } from '../../../util/toml.ts';
import * as poetryVersioning from '../../versioning/poetry/index.ts';
import type { PackageFileContent } from '../types.ts';
import {
  getPoetryMinReleaseAgeRules,
  poetryMinReleaseAgeVersion,
  readPoetryMinReleaseAgeConfig,
} from './minimum-release-age.ts';
import {
  Lockfile,
  PoetryPyProject,
  getRegistryUrls,
  withImplicitPypi,
} from './schema.ts';
import { getLockfilePoetryVersion } from './utils.ts';

/**
 * Whether the Poetry version which wrote the lock file is older than `version`, or `false` if it is unknown.
 */
function isLockfilePoetryOlderThan(
  lockContents: string | undefined,
  version: string,
): boolean {
  const lockfileVersion =
    lockContents && getLockfilePoetryVersion(lockContents);
  if (!lockfileVersion) {
    return false;
  }

  // a non-exact value is a constraint inferred from lock-version, i.e. < 1.4
  return (
    !poetryVersioning.api.isVersion(lockfileVersion) ||
    poetryVersioning.api.isGreaterThan(version, lockfileVersion)
  );
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`poetry.extractPackageFile(${packageFile})`);
  const { val: parsed, err } = Result.parse(
    massageToml(content),
    PoetryPyProject,
  ).unwrap();
  if (err) {
    logger.debug({ packageFile, err }, `Poetry: error parsing pyproject.toml`);
    return null;
  }
  const { packageFileContent: res, poetrySources } = parsed;

  const lockfileName = getSiblingFileName(packageFile, 'poetry.lock');
  const lockContents = (await readLocalFile(lockfileName, 'utf8'))!;
  const lockfileMapping = Result.parse(
    lockContents,
    Lockfile.transform(({ lock }) => lock),
  ).unwrapOr({});

  // before Poetry 1.8, PyPI was implicitly added as a secondary source even when a primary source was configured
  if (
    poetrySources?.length &&
    isLockfilePoetryOlderThan(lockContents, '1.8.0')
  ) {
    res.registryUrls = getRegistryUrls(withImplicitPypi(poetrySources, true));
  }

  filterMap(res.deps, (dep) => {
    const packageName = dep.packageName ?? dep.depName;
    if (
      packageName &&
      packageName !== 'python' &&
      packageName in lockfileMapping
    ) {
      dep.lockedVersion = lockfileMapping[packageName];
    }

    return dep;
  });

  if (!res.deps.length) {
    return null;
  }

  if (!isLockfilePoetryOlderThan(lockContents, poetryMinReleaseAgeVersion)) {
    const rules = getPoetryMinReleaseAgeRules(
      await readPoetryMinReleaseAgeConfig(packageFile),
    );
    if (rules.length) {
      res.packageRules = rules;
    }
  }

  // Try poetry.lock first
  let lockFile = getSiblingFileName(packageFile, 'poetry.lock');
  // istanbul ignore next
  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  } else {
    // Try pyproject.lock next
    lockFile = getSiblingFileName(packageFile, 'pyproject.lock');
    if (await localPathExists(lockFile)) {
      res.lockFiles = [lockFile];
    }
  }
  return res;
}
