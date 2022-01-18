import { GalaxyCollectionDatasource } from '../../datasource/galaxy-collection';
import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import extractPackageFile from './extract';

export { extractPackageFile };

export const supportedDatasources = [
  GalaxyCollectionDatasource.id,
  GitTagsDatasource.id,
  datasourceGithubTags.id,
];
export const defaultConfig = {
  fileMatch: ['(^|/)requirements\\.ya?ml$', '(^|/)galaxy\\.ya?ml$'],
};
