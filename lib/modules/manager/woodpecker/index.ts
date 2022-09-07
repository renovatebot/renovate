import { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Docker;

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|\\/)\\.woodpecker[^/]*\\.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];
