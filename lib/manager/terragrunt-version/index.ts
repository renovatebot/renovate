import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.terragrunt-version$'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.+)$',
};
