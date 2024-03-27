import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)[\\w-]*requirements([-.]\\w+)?\\.(txt|pip)$'],
};

export const categories: Category[] = ['python'];

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];
