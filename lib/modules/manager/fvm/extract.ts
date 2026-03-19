import { logger } from '../../../logger/index.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { FlutterVersionDatasource } from '../../datasource/flutter-version/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { FvmConfig } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let flutterVersion: string | undefined;
  try {
    const config = Json.pipe(FvmConfig).parse(content);
    flutterVersion = config.flutter ?? config.flutterSdkVersion;

    if (!flutterVersion) {
      logger.debug(
        { contents: config },
        'FVM config does not have a flutter version specified',
      );
      return null;
    }
  } catch (err) {
    logger.debug({ packageFile, err }, 'Invalid FVM config');
    return null;
  }

  const dep: PackageDependency = {
    depName: 'flutter',
    currentValue: flutterVersion,
    datasource: FlutterVersionDatasource.id,
    packageName: 'flutter/flutter',
  };
  return { deps: [dep] };
}
