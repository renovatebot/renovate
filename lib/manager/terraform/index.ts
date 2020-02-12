import { VERSION_SCHEME_HASHICORP } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depNameShort}}',
  fileMatch: ['\\.tf$'],
  versionScheme: VERSION_SCHEME_HASHICORP,
};
