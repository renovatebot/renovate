import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import type {
  ExtractConfig,
  PackageFileContent,
  UpdateArtifact,
  UpdateArtifactsResult,
  UpdateLockedConfig,
  UpdateLockedResult,
} from '../types';

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

export const supportsLockFileMaintenance = true;
export const defaultConfig = {
  commitMessageTopic: 'Terraform {{depName}}',
  fileMatch: ['\\.tf$'],
  pinDigests: false,
};

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFileContent | null> {
  return import('./extract').then((m) =>
    m.extractPackageFile(content, fileName, config)
  );
}

export function updateArtifacts(
  config: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  return import('./lockfile').then((m) => m.updateArtifacts(config));
}

export function updateLockedDependency(
  config: UpdateLockedConfig
): Promise<UpdateLockedResult> {
  return import('./lockfile/update-locked').then((m) =>
    m.updateLockedDependency(config)
  );
}
