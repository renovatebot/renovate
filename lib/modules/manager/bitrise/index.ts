import type { Category } from '../../../constants';
import { extractPackageFile } from './extract';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)bitrise\\.ya?ml$'],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [GithubReleasesDatasource.id];

export const urls = [
  'https://devcenter.bitrise.io/en/steps-and-workflows/introduction-to-steps.html',
];
