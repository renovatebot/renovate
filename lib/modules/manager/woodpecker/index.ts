import type { Category, ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['^\\.woodpecker(?:/[^/]+)?\\.ya?ml$'],
};

//TODO remove "docker" in major version, as this is no longer fitting the category concept
export const categories: Category[] = ['ci', 'docker'];

export const supportedDatasources = [DockerDatasource.id];
