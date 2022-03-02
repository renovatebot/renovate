import { DartDatasource } from '../../datasource/dart';
import * as npmVersioning from '../../modules/versioning/npm';

export { extractPackageFile } from './extract';

export const supportedDatasources = [DartDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};
