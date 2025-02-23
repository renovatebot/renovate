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
import { LockfileYaml, PixiSchemaToml } from './schema';

// TODO: parse locked version from lockfile
// this is complicated because pixi.lock doesn't contain version of each package but wheels url of each platform.
// This is also not very possible since pixi may use different version for different platform.
// If users set multiple platform in `pixi.toml`, single package have multiple locked versions.

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`pixi.extractPackageFile(${packageFile})`);
  const { val: res, err } = Result.parse(content, PixiSchemaToml).unwrap();
  if (err) {
    logger.debug({ packageFile, err }, `pixi: error parsing pyproject.toml`);
    return null;
  }

  let pythonVersion: string | undefined = res.condaDeps?.python;

  const extractedConstraints: Record<string, any> = {};

  if (is.nonEmptyString(pythonVersion)) {
    extractedConstraints.python = pythonVersion;
  }

  const lockfileName = getSiblingFileName(packageFile, 'pixi.lock');
  const lockFiles = [];
  if (await localPathExists(lockfileName)) {
    lockFiles.push(lockfileName);
  }

  return {
    lockFiles,
    extractedConstraints,
    deps: res.pypiDeps,
  };
}
