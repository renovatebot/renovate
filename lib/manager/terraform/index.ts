import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depNameShort}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
};
