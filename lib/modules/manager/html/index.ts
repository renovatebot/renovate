import { CdnJsDatasource } from '../../datasource/cdnjs';
import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.html?$'],
  filePatterns: ['**/*.html', '**/*.htm'], // not used yet
  versioning: semverVersioning.id,
  digest: {
    enabled: false,
  },
  pinDigests: false,
};

export const supportedDatasources = [CdnJsDatasource.id];
