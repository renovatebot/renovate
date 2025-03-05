import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { Result } from '../../../util/result';
import { Toml } from '../../../util/schema-utils';
import { PyProjectSchema } from '../pep621/schema';
import type { PackageFileContent } from '../types';
import { type PixiConfig, PixiToml } from './schema';

const PyProjectToml = Toml.pipe(PyProjectSchema);

function getUserPixiConfig(
  content: string,
  packageFile: string,
): null | PixiConfig {
  if (packageFile.endsWith('pyproject.toml')) {
    const { val, err } = Result.parse(content, PyProjectToml).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val.tool?.pixi ?? null;
  }

  if (packageFile.endsWith('pixi.toml')) {
    const { val, err } = Result.parse(content, PixiToml).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val;
  }

  const { val: maybePyprojectConfig } = Result.parse(
    content,
    PyProjectToml,
  ).unwrap();

  if (maybePyprojectConfig?.tool?.pixi) {
    return maybePyprojectConfig.tool.pixi;
  }

  const { val: maybePixiConfig } = Result.parse(content, PixiToml).unwrap();
  return maybePixiConfig ?? null;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.info(`pixi.extractPackageFile(${packageFile})`);

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
    deps: [...config.conda, ...config.pypi],
  };
}
