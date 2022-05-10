import { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

const language = ProgrammingLanguage.Docker;

export { extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['(^|/).vela.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];
