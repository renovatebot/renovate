import { configFileNames } from '../../../config/app-strings';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';

export { extractPackageFile } from './extract';

export const url = '../../../config-presets.md';

export const defaultConfig = {
  fileMatch: configFileNames
    .filter((name) => name !== 'package.json')
    .map((name) => `^${name.replaceAll('.', '\\.')}$`),
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GiteaTagsDatasource.id,
];
