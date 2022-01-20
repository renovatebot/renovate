import { id as githubTagsId } from '../../datasource/github-tags';
import { id as gitlabTagsId } from '../../datasource/gitlab-tags';
export { extractPackageFile } from './extract';

export const supportedDatasources = [githubTagsId, gitlabTagsId];

export const defaultConfig = {
  commitMessageTopic: 'pre-commit hook {{depName}}',
  enabled: false,
  fileMatch: ['(^|/)\\.pre-commit-config\\.yaml$'],
  prBodyNotes: [
    'Note: The `pre-commit` manager in Renovate is not supported by the `pre-commit` maintainers or community. Please do not report any problems there, instead [create a Discussion in the Renovate repository](https://github.com/renovatebot/renovate/discussions/new) if you have any questions.',
  ],
};
