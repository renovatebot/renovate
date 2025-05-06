import type { Category } from '../../../constants';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { extractPackageFile } from './extract';

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
