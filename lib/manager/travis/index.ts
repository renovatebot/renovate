import { ProgrammingLanguage } from '../../constants';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.NodeJS;

export const supportedDatasources = [datasourceGithubTags.id];

export const defaultConfig = {
  fileMatch: ['^.travis.yml$'],
  major: {
    enabled: false,
  },
  versioning: nodeVersioning.id,
};
