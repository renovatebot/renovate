import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import type { PackageDependency, PackageFileContent } from '../types';

interface FvmConfig {
  flutterSdkVersion: string;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
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
      'FVM config does not have flutterSdkVersion specified',
    );
    return null;
  } else if (!is.string(fvmConfig.flutterSdkVersion)) {
    logger.debug({ contents: fvmConfig }, 'flutterSdkVersion must be a string');
    return null;
  }

  const dep: PackageDependency = {
    depName: 'flutter',
    currentValue: fvmConfig.flutterSdkVersion,
    datasource: FlutterVersionDatasource.id,
    packageName: 'flutter/flutter',
  };
  return { deps: [dep] };
}
