import type { Category } from '../../../constants/index.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { TerraformModuleDatasource } from '../../datasource/terraform-module/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['.terraform.lock.hcl'];

export const url = 'https://terragrunt.gruntwork.io/docs';
export const categories: Category[] = ['iac', 'terraform'];

export const defaultConfig = {
  commitMessageTopic: 'Terragrunt dependency {{depName}}',
  managerFilePatterns: ['/(^|/)terragrunt\\.hcl$/'],
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  BitbucketTagsDatasource.id,
  GiteaTagsDatasource.id,
  TerraformModuleDatasource.id,
];
