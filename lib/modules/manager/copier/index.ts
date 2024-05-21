import { GitTagsDatasource } from '../../datasource/git-tags';
import * as pep440 from '../../versioning/pep440';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.copier-answers(\\..+)?\\.ya?ml'],
  versioning: pep440.id,
};

export const supportedDatasources = [GitTagsDatasource.id];
