import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency, PackageFile } from '../types';

interface FvmConfig {
  flutterSdkVersion: string;
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  let fvmConfig: FvmConfig;
  try {
    fvmConfig = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile, err }, 'Invalid FVM config');
    return null;
  }

  if (!fvmConfig.flutterSdkVersion) {
    logger.debug(
      { contents: fvmConfig },
      'FVM config does not have flutterSdkVersion specified'
    );
    return null;
  } else if (!is.string(fvmConfig.flutterSdkVersion)) {
    logger.debug({ contents: fvmConfig }, 'flutterSdkVersion must be a string');
    return null;
  }

  const dep: PackageDependency = {
    depName: 'flutter',
    currentValue: fvmConfig.flutterSdkVersion,
    datasource: GithubTagsDatasource.id,
    lookupName: 'flutter/flutter',
  };
  return { deps: [dep] };
}
