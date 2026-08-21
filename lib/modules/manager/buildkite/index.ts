import type { Category } from '../../../constants/index.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const url = 'https://buildkite.com/docs';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/buildkite\\.ya?ml/', '/\\.buildkite/.+\\.ya?ml$/'],
  commitMessageTopic: 'buildkite plugin {{depName}}',
  commitMessageExtra:
    'to {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{newValue}}}{{/if}}',
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  BitbucketTagsDatasource.id,
];
