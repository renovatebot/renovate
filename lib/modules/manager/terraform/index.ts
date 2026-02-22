import type { Category } from '../../../constants/index.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { TerraformModuleDatasource } from '../../datasource/terraform-module/index.ts';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './lockfile/index.ts';
export { updateLockedDependency } from './lockfile/update-locked.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['.terraform.lock.hcl'];

export const url = 'https://developer.hashicorp.com/terraform/docs';
export const categories: Category[] = ['iac', 'terraform'];

export const defaultConfig = {
  commitMessageTopic: 'Terraform {{depName}}',
  managerFilePatterns: ['**/*.tf', '**/*.tofu'],
  pinDigests: false,
};

export const supportedDatasources = [
  BitbucketTagsDatasource.id,
  DockerDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  HelmDatasource.id,
  TerraformModuleDatasource.id,
  TerraformProviderDatasource.id,
];
