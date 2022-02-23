import { GithubTagsDatasource } from '../../datasource/github-tags';
import { logger } from '../../logger';
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
    logger.debug({ packageFile }, 'Invalid FVM config');
    return null;
  }

  if (!fvmConfig.flutterSdkVersion) {
    logger.debug(
      { contents: fvmConfig },
      'FVM config does not have flutterSdkVersion specified'
    );
    return null;
  } else if (typeof fvmConfig.flutterSdkVersion !== 'string') {
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
