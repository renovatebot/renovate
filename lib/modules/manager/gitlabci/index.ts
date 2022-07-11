import type { Category, ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

export const categories = [Category.CI];

export const supportedDatasources = [DockerDatasource.id];
