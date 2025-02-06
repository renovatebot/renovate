import type { Category } from '../../../constants';
import { BitriseDatasource } from '../../datasource/bitrise';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://devcenter.bitrise.io';
export const categories: Category[] = ['ci'];
export const urls = [
  'https://devcenter.bitrise.io/en/steps-and-workflows/introduction-to-steps.html',
];

export const defaultConfig = {
  fileMatch: ['(^|/)bitrise\\.ya?ml$'],
};

export const supportedDatasources = [
  BitriseDatasource.id,
  GitTagsDatasource.id,
];
