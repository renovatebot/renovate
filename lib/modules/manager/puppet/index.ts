import { ProgrammingLanguage } from '../../../constants';
import { ForgeDatasource } from '../../datasource/forge';
import { GithubTagsDatasource } from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Ruby;

export const defaultConfig = {
  fileMatch: ['^Puppetfile$'],
};

export const supportedDatasources = [
  ForgeDatasource.id,
  GithubTagsDatasource.id,
];
