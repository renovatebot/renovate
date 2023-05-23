import type { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)\\.drone\\.yml$'],
  filePatterns: ['**/.drone.{yml,yaml}'], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];
