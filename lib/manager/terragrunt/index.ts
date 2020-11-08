import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic:
    'Terragrunt {{managerData.terragruntDependencyType}} {{depNameShort}}',
  fileMatch: ['\\.hcl$'],
  versioning: hashicorpVersioning.id,
};
