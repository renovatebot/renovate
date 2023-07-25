import type { Category } from '../../../constants';
import { DartDatasource } from '../../datasource/dart';
import * as npmVersioning from '../../versioning/npm';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportedDatasources = [DartDatasource.id];
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};

export const categories: Category[] = ['dart'];
