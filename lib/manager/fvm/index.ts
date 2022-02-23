import { ProgrammingLanguage } from '../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as npmVersioning from '../../versioning/npm';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Dart;

export const supportedDatasources = [GithubTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.fvm/fvm_config.json$'],
  versioning: npmVersioning.id,
};
