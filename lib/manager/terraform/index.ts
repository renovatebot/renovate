import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depNameShort}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
};
