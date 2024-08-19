import type { Category } from '../../../constants';
import { BitriseDatasource } from '../../datasource/bitrise';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)bitrise\\.ya?ml$'],
};

export const displayName = 'Bitrise';

export const categories: Category[] = ['ci'];

export const supportedDatasources = [
  BitriseDatasource.id,
  GitTagsDatasource.id,
];

export const urls = [
  'https://devcenter.bitrise.io/en/steps-and-workflows/introduction-to-steps.html',
];
