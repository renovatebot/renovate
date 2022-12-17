import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';

export { updateArtifacts } from './lockfile';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  BitBucketTagsDatasource.id,
  DockerDatasource.id,
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
  pinDigests: false,
};
