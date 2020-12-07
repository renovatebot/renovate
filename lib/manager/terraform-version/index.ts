import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.terraform-version$'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.*)$',
};
