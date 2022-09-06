import { GitTagsDatasource } from '../../datasource/git-tags';

export const displayName = 'Mint';
export const url = 'https://github.com/yonaskolb/Mint';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GitTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|\\/)Mintfile$'],
};
