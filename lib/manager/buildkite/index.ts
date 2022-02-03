import * as datasourceGithubTags from '../../datasource/github-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['buildkite\\.ya?ml', '\\.buildkite/.+\\.ya?ml$'],
  commitMessageTopic: 'buildkite plugin {{depName}}',
  commitMessageExtra:
    'to {{#if isMajor}}v{{{newMajor}}}{{else}}{{{newValue}}}{{/if}}',
};

export const supportedDatasources = [datasourceGithubTags.id];
