import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)Puppetfile$'],
};

export const categories: Category[] = ['iac', 'ruby'];

export const supportedDatasources = [
  PuppetForgeDatasource.id,
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
];
