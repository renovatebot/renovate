import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import * as swiftVersioning from '../../versioning/swift';

export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const displayName = 'Swift Package Manager';
export const url = 'https://www.swift.org/package-manager/';

export const supportedDatasources = [GitTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)Package\\.swift'],
  versioning: swiftVersioning.id,
  pinDigests: false,
};

export const categories: Category[] = ['swift'];
