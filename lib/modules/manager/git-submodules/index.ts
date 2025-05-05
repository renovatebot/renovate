import { GitRefsDatasource } from '../../datasource/git-refs';
import * as gitVersioning from '../../versioning/git';

export { default as extractPackageFile } from './extract';
export { default as updateDependency } from './update';
export { default as updateArtifacts } from './artifacts';

export const url = 'https://git-scm.com/docs/git-submodule';

export const defaultConfig = {
  enabled: false,
  versioning: gitVersioning.id,
  managerFilePatterns: ['/(^|/)\\.gitmodules$/'],
};

export const supportedDatasources = [GitRefsDatasource.id];
