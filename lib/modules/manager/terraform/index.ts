import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { updateArtifacts } from './lockfile';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  BitBucketTagsDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  HelmDatasource.id,
  TerraformModuleDatasource.id,
  TerraformProviderDatasource.id,
];

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic: 'Terraform {{depName}}',
  fileMatch: ['\\.tf$'],
  versioning: hashicorpVersioning.id,
  pinDigests: false,
};
