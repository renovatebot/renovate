import type { Category } from '../../../constants';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  BitbucketTagsDatasource.id,
  GiteaTagsDatasource.id,
  TerraformModuleDatasource.id,
];

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic: 'Terragrunt dependency {{depName}}',
  fileMatch: ['(^|/)terragrunt\\.hcl$'],
};

export const categories: Category[] = ['iac', 'terraform'];
