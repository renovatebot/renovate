import * as hashicorpVersioning from '../../versioning/hashicorp';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depName}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
};
