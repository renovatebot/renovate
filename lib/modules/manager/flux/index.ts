import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';
import { systemManifestRegex } from './common';

export { updateArtifacts } from './artifacts';
export { extractAllPackageFiles, extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [systemManifestRegex],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  HelmDatasource.id,
];
