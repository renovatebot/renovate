import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import type { PackageDependency, PackageFileContent } from '../types';

interface FvmConfig {
  flutterSdkVersion?: string;
  flutter?: string;
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

  for (const version of [fvmConfig.flutterSdkVersion, fvmConfig.flutter]) {
    if (!version) {
      continue;
    } else if (!is.string(version)) {
      logger.debug({ contents: fvmConfig }, 'flutterSdkVersion or flutter must be a string');
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

  logger.debug(
    { contents: fvmConfig },
    'FVM config does not have flutterSdkVersion or flutter specified',
  );
  return null;
}
