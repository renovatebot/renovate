import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { filterMap } from '../../../util/filter-map';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { Result } from '../../../util/result';
import type { PackageFileContent } from '../types';
import { Lockfile, PoetrySchemaToml } from './schema';

export async function extractPackageFile(
  content: string,
  packageFile: string
): Promise<PackageFileContent | null> {
  logger.trace(`poetry.extractPackageFile(${packageFile})`);
  const { val: res, err } = Result.parse(
    PoetrySchemaToml.transform(({ packageFileContent }) => packageFileContent),
    content
  ).unwrap();
  if (err) {
    logger.debug({ packageFile, err }, `Poetry: error parsing pyproject.toml`);
    return null;
  }

  const lockfileName = getSiblingFileName(packageFile, 'poetry.lock');
  const lockContents = (await readLocalFile(lockfileName, 'utf8'))!;
  const lockfileMapping = Result.parse(
    Lockfile.transform(({ lock }) => lock),
    lockContents
  ).unwrapOrElse({});

  let pythonVersion: string | undefined;
  filterMap(res.deps, (dep) => {
    if (dep.depName === 'python') {
      if (dep.currentValue) {
        pythonVersion = dep.currentValue;
      }
      return null;
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

  if (is.nonEmptyString(pythonVersion)) {
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
