import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://www.puppet.com/docs/index.html';
export const categories: Category[] = ['iac', 'ruby'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Puppetfile$/'],
};

export const supportedDatasources = [
  PuppetForgeDatasource.id,
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
];
