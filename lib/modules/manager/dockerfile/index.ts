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
};

export const supportedDatasources = [DockerDatasource.id];
