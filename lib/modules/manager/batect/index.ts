import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)batect(-bundle)?\\.ya?ml$'],
};

export const categories: Category[] = ['batect'];

export const supportedDatasources = [GitTagsDatasource.id];
