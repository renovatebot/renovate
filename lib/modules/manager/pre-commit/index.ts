import { getEnv } from '../../../util/env.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'pre-commit';
export const url = 'https://pre-commit.com';

export const defaultConfig = {
  commitMessageTopic: 'pre-commit hook {{depName}}',
  enabled: false,
  managerFilePatterns: ['/(^|/)\\.pre-commit-config\\.ya?ml$/'],
  prBodyNotes: getEnv().RENOVATE_X_SUPPRESS_PRE_COMMIT_WARNING
    ? /* istanbul ignore next */
      []
    : [
        'Note: The `pre-commit` manager in Renovate is not supported by the `pre-commit` maintainers or community. Please do not report any problems there, instead [create a Discussion in the Renovate repository](https://github.com/renovatebot/renovate/discussions/new) if you have any questions.',
      ],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
];
