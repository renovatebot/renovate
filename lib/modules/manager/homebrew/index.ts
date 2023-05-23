import { GithubTagsDatasource } from '../../datasource/github-tags';
export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic: 'Homebrew Formula {{depName}}',
  fileMatch: ['^Formula/[^/]+[.]rb$'],
  filePatterns: ['Formula/*.rb'], // not used yet
};

export const supportedDatasources = [GithubTagsDatasource.id];
