import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)batect(-bundle)?\\.ya?ml$'],
  filePatterns: ['**/batect.{yml,yaml}', '**/batect-bundle.{yml,yaml}'], // not used yet
};

export const supportedDatasources = [GitTagsDatasource.id];
