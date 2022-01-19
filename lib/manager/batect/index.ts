import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)batect(-bundle)?\\.yml$'],
};

export const supportedDatasources = [GitTagsDatasource.id];
