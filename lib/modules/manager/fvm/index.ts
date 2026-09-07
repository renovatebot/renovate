import type { Category } from '../../../constants/index.ts';
import { FlutterVersionDatasource } from '../../datasource/flutter-version/index.ts';

export const categories: Category[] = ['dart'];

import type { DatasourceName } from '../../../datasource-list.generated.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'FVM';
export const url = 'https://fvm.app';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.fvm/fvm_config\\.json$/', '/(^|/)\\.fvmrc$/'],
  versioning: semverVersioning.id,
};

export const supportedDatasources: DatasourceName[] = [
  FlutterVersionDatasource.id,
];
