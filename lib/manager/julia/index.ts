import * as juliaVersioning from '../../versioning/julia';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)Project.toml$'],
  versioning: juliaVersioning.id,
  rangeStrategy: 'replace',
};
