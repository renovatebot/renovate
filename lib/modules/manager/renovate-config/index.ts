import { getConfigFileNames } from '../../../config/app-strings.ts';
import { allToolConfig } from '../../../util/exec/containerbase.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const defaultConfig = {
  managerFilePatterns: getConfigFileNames().filter(
    (name) => name !== 'package.json',
  ),
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GiteaTagsDatasource.id,

  ...Object.values(allToolConfig).map((conf) => conf.datasource),
];
