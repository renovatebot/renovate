import { ProgrammingLanguage } from '../../constants';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.NodeJS;

export const defaultConfig = {
  fileMatch: ['(^|/)\\.nvmrc$'],
  versioning: nodeVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [datasourceGithubTags.id];
