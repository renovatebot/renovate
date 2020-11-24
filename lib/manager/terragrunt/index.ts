import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'Terragrunt dependency {{depNameShort}}',
  fileMatch: ['(^|/)terragrunt\\.hcl$'],
  versioning: hashicorpVersioning.id,
};
