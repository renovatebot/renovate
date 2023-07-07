import type { Category } from '../../../constants';
import { CdnJsDatasource } from '../../datasource/cdnjs';
import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: [],
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['cd'];

export const supportedDatasources = [CdnJsDatasource.id];
