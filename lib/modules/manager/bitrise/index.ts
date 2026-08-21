import type { Category } from '../../../constants/index.ts';
import { BitriseDatasource } from '../../datasource/bitrise/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const url = 'https://devcenter.bitrise.io';
export const categories: Category[] = ['ci'];
export const urls = [
  'https://devcenter.bitrise.io/en/steps-and-workflows/introduction-to-steps.html',
];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)bitrise\\.ya?ml$/'],
};

export const supportedDatasources = [
  BitriseDatasource.id,
  GitTagsDatasource.id,
];
