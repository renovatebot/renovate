import type { Category } from '../../../constants';
import { BitriseDatasource } from '../../datasource/bitrise';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)bitrise\\.ya?ml$'],
};

export const displayName = 'Bitrise';

export const categories: Category[] = ['ci'];

export const supportedDatasources = [BitriseDatasource.id];

export const urls = [
  'https://devcenter.bitrise.io/en/steps-and-workflows/introduction-to-steps.html',
];
