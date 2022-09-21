import { GithubTagsDatasource } from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

export const displayName = 'asdf';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.tool-versions$'],
};

export const supportedDatasources = [GithubTagsDatasource.id];
