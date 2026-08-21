import type { Category } from '../../../constants/index.ts';
import { CdnjsDatasource } from '../../datasource/cdnjs/index.ts';
import { JsDelivrDatasource } from '../../datasource/jsdelivr/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const displayName = 'LibMan';
export const url =
  'https://learn.microsoft.com/aspnet/core/client-side/libman/';
export const categories: Category[] = ['dotnet', 'js'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)libman\\.json$/'],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [CdnjsDatasource.id, JsDelivrDatasource.id];
