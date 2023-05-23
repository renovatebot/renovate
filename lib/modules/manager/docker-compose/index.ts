import type { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)(?:docker-)?compose[^/]*\\.ya?ml$'],
  filePatterns: [
    '**/compose.{yml,yaml}',
    '**/compose-*.{yml,yaml}',
    '**/compose.*.{yml,yaml}',
    '**/compose_*.{yml,yaml}',
    '**/docker-compose.{yml,yaml}',
    '**/docker-compose.*.{yml,yaml}',
    '**/docker-compose-*.{yml,yaml}',
  ], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];
