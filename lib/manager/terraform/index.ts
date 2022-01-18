import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { updateArtifacts } from './lockfile';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  BitBucketTagsDatasource.id,
  GitTagsDatasource.id,
  datasourceGithubTags.id,
  TerraformModuleDatasource.id,
];

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic:
    'Terraform {{managerData.terraformDependencyType}} {{depName}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
};
