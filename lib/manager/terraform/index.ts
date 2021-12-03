import * as hashicorpVersioning from '../../versioning/hashicorp';

export { updateArtifacts } from './lockfile';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depName}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
};
