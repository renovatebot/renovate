import * as hashicorpVersioning from '../../versioning/hashicorp';

import { updateArtifacts } from './lockfile';

export { updateArtifacts };
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depName}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
};
