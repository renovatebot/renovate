import { GithubTagsDatasource } from '../../datasource/github-tags';
export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic: 'Homebrew Formula {{depName}}',
  fileMatch: ['^Formula/[^/]+[.]rb$'],
};

export const supportedDatasources = [GithubTagsDatasource.id];
