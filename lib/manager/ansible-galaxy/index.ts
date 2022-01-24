import { GalaxyCollectionDatasource } from '../../datasource/galaxy-collection';
import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)requirements\\.ya?ml$', '(^|/)galaxy\\.ya?ml$'],
};

export const supportedDatasources = [
  GalaxyCollectionDatasource.id,
  GitTagsDatasource.id,
  datasourceGithubTags.id,
];
