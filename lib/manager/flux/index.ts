import { id as GithubReleasesId } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';
import { systemManifestRegex } from './common';

export { extractAllPackageFiles, extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: [systemManifestRegex],
};

export const supportedDatasources = [GithubReleasesId, HelmDatasource.id];
