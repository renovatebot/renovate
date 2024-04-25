import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
];

export const defaultConfig = {
  commitMessageTopic: 'pre-commit hook {{depName}}',
  enabled: false,
  fileMatch: ['(^|/)\\.pre-commit-config\\.ya?ml$'],
  prBodyNotes: process.env.RENOVATE_X_SUPPRESS_PRE_COMMIT_WARNING
    ? /* istanbul ignore next */
      []
    : [
        'Note: The `pre-commit` manager in Renovate is not supported by the `pre-commit` maintainers or community. Please do not report any problems there, instead [create a Discussion in the Renovate repository](https://github.com/renovatebot/renovate/discussions/new) if you have any questions.',
      ],
};
