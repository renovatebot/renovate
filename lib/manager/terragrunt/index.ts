import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const supportedDatasources = [
  GitTagsDatasource.id,
  datasourceGithubTags.id,
  TerraformModuleDatasource.id,
];

export const defaultConfig = {
  commitMessageTopic: 'Terragrunt dependency {{depName}}',
  fileMatch: ['(^|/)terragrunt\\.hcl$'],
  versioning: hashicorpVersioning.id,
};
