import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { Result } from '../../../util/result';
import type { PackageFileContent } from '../types';
import { type PixiConfig, PixiToml, PyprojectToml } from './schema';

function getUserPixiConfig(
  content: string,
  packageFile: string,
): null | PixiConfig {
  if (packageFile.endsWith('pyproject.toml')) {
    const { val, err } = Result.parse(content, PyprojectToml).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val;
  }

  if (packageFile.endsWith('pixi.toml')) {
    const { val, err } = Result.parse(content, PixiToml).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val;
  }

  /* v8 ignore next 2 */
  return null;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`pixi.extractPackageFile(${packageFile})`);

  const config = getUserPixiConfig(content, packageFile);
  if (!config) {
    return null;
  }

  const lockfileName = getSiblingFileName(packageFile, 'pixi.lock');
  const lockFiles: string[] = [];
  if (await localPathExists(lockfileName)) {
    lockFiles.push(lockfileName);
  }

  return {
    lockFiles,
    deps: [],
  };
}
