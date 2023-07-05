import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['buildkite\\.ya?ml', '\\.buildkite/.+\\.ya?ml$'],
  commitMessageTopic: 'buildkite plugin {{depName}}',
  commitMessageExtra:
    'to {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{newValue}}}{{/if}}',
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [GithubTagsDatasource.id];
