import type { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: [
    '(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$',
    '(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$',
  ],
  filePatterns: [
    '**/[Dd]ockerfile*',
    '**/.[Dd]ockerfile*',
    '**/[Cc]ontainerfile*',
    '**/.[Cc]ontainerfile*',
  ], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];
