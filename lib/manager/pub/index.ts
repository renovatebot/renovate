import { ProgrammingLanguage } from '../../constants';
import { DartDatasource } from '../../datasource/dart';
import * as npmVersioning from '../../versioning/npm';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Dart;

export const supportedDatasources = [DartDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};
