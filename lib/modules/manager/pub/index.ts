import type { Category } from '../../../constants';
import { DartDatasource } from '../../datasource/dart';
import { DartVersionDatasource } from '../../datasource/dart-version';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

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
