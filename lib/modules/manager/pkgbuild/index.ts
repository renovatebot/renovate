import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const url = 'https://wiki.archlinux.org/title/PKGBUILD';

export const defaultConfig = {
  commitMessageTopic: 'PKGBUILD package {{depName}}',
  managerFilePatterns: ['(^|/)PKGBUILD$'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
];
