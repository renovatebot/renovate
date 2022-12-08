import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const supportedDatasources = [FlutterVersionDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.fvm/fvm_config\\.json$'],
  versioning: semverVersioning.id,
};
