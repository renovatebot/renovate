import { ProgrammingLanguage } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Ruby;
export const defaultRegistry = 'https://forgeapi.puppetlabs.com';

export const defaultConfig = {
  fileMatch: ['^Puppetfile$'],
};

export const supportedDatasources = [
  PuppetForgeDatasource.id,
  GithubTagsDatasource.id,
];
