import type { Category } from '../../../constants';
import { DartDatasource } from '../../datasource/dart';
import { DartVersionDatasource } from '../../datasource/dart-version';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import * as npmVersioning from '../../versioning/npm';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  DartDatasource.id,
  DartVersionDatasource.id,
  FlutterVersionDatasource.id,
];

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};

export const categories: Category[] = ['dart'];
