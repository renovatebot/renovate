import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import * as gitVersioning from '../../versioning/git/index.ts';

export { default as updateArtifacts } from './artifacts.ts';
export { default as extractPackageFile } from './extract.ts';
export { default as updateDependency } from './update.ts';

export const url = 'https://git-scm.com/docs/git-submodule';

export const defaultConfig = {
  enabled: false,
  versioning: gitVersioning.id,
  managerFilePatterns: ['/(^|/)\\.gitmodules$/'],
};

export const supportedDatasources = [GitRefsDatasource.id];
