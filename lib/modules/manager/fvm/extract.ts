import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let fvmConfig: any;
  try {
    fvmConfig = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile, err }, 'Invalid FVM config');
    return null;
  }

  const version = getVersion(fvmConfig, 'flutterSdkVersion') ?? getVersion(fvmConfig, 'flutter');
  if (!version) {
    logger.debug(
      { contents: fvmConfig },
      'FVM config does not have flutterSdkVersion or flutter specified',
    );
    return null;
  }

  const dep: PackageDependency = {
    depName: 'flutter',
    currentValue: version,
    datasource: FlutterVersionDatasource.id,
    packageName: 'flutter/flutter',
  };
  return { deps: [dep] };
}

function getVersion(config: any, field: string): string | null {
  const version = config[field];
  if (!version) {
    return null;
  } else if (!is.string(version)) {
    logger.debug({ contents: config }, `${field} must be a string`);
    return null;
  }
  return version;
}
