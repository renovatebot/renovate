import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { filterMap } from '../../../util/filter-map.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { Result } from '../../../util/result.ts';
import { massage as massageToml } from '../../../util/toml.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import type { PackageFileContent } from '../types.ts';
import { Lockfile, PoetryPyProject } from './schema.ts';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`poetry.extractPackageFile(${packageFile})`);
  const { val: res, err } = Result.parse(
    massageToml(content),
    PoetryPyProject.transform(({ packageFileContent }) => packageFileContent),
  ).unwrap();
  if (err) {
    logger.debug({ packageFile, err }, `Poetry: error parsing pyproject.toml`);
    return null;
  }

  const lockfileName = getSiblingFileName(packageFile, 'poetry.lock');
  const lockContents = (await readLocalFile(lockfileName, 'utf8'))!;
  const lockfileMapping = Result.parse(
    lockContents,
    Lockfile.transform(({ lock }) => lock),
  ).unwrapOr({});

  let pythonVersion: string | undefined;
  filterMap(res.deps, (dep) => {
    if (dep.depName === 'python') {
      if (dep.currentValue) {
        pythonVersion = dep.currentValue;
      }
      return {
        ...dep,
        // We use containerbase python as source, as there are a lot docker tags which can cause
        // issues with poetry versioning.
        packageName: 'containerbase/python-prebuild',
        datasource: GithubReleasesDatasource.id,
        commitMessageTopic: 'Python',
        registryUrls: null,
      };
    }

    const packageName = dep.packageName ?? dep.depName;
    if (packageName && packageName in lockfileMapping) {
      dep.lockedVersion = lockfileMapping[packageName];
    }

    return dep;
  });

  if (!res.deps.length) {
    return null;
  }

  const extractedConstraints: Record<string, any> = {};

  if (isNonEmptyString(pythonVersion)) {
    extractedConstraints.python = pythonVersion;
  }
  res.extractedConstraints = extractedConstraints;

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
