import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const displayName = 'pip Requirements';
export const url =
  'https://pip.pypa.io/en/stable/reference/requirements-file-format';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: ['(^|/)[\\w-]*requirements([-.]\\w+)?\\.(txt|pip)$'],
};

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];
