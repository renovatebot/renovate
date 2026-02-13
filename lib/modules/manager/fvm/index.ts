import { FlutterVersionDatasource } from '../../datasource/flutter-version/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'FVM';
export const url = 'https://fvm.app';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.fvm/fvm_config\\.json$/', '/(^|/)\\.fvmrc$/'],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [FlutterVersionDatasource.id];
