import type { Category } from '../../../constants/index.ts';
import { DartDatasource } from '../../datasource/dart/index.ts';
import { DartVersionDatasource } from '../../datasource/dart-version/index.ts';
import { FlutterVersionDatasource } from '../../datasource/flutter-version/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['pubspec.lock'];

export const displayName = 'pub';
export const url = 'https://dart.dev/tools/pub/packages';
export const categories: Category[] = ['dart'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)pubspec\\.ya?ml$/'],
};

export const supportedDatasources = [
  DartDatasource.id,
  DartVersionDatasource.id,
  FlutterVersionDatasource.id,
];
