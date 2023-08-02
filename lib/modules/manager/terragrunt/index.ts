import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  TerraformModuleDatasource.id,
];

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic: 'Terragrunt dependency {{depName}}',
  fileMatch: ['(^|/)terragrunt\\.hcl$'],
};

export const categories: Category[] = ['iac', 'terraform'];
