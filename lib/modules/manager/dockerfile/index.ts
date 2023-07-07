import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: [
    '(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$',
    '(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$',
  ],
};

export const categories: Category[] = ['docker'];

export const supportedDatasources = [DockerDatasource.id];
