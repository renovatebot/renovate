import { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)batect(-bundle)?\\.yml$'],
};

export const categories = [Category.Batect];

export const supportedDatasources = [GitTagsDatasource.id];
