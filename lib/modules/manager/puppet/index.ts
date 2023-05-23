import type { ProgrammingLanguage } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'ruby';

export const defaultConfig = {
  fileMatch: ['(^|/)Puppetfile$'],
  filePatterns: ['**/Puppetfile'], // not used yet
};

export const supportedDatasources = [
  PuppetForgeDatasource.id,
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
];
