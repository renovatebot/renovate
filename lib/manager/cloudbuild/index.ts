import * as datasourceDocker from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)cloudbuild.ya?ml'],
};

export const supportedDatasources = [datasourceDocker.id];
