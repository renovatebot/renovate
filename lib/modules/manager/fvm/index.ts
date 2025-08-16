import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const displayName = 'FVM';
export const url = 'https://fvm.app';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.fvm/fvm_config\\.json$/', '/(^|/)\\.fvmrc$/'],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [FlutterVersionDatasource.id];
