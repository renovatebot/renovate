import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';

export { extractAllPackageFiles, extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const systemManifestRegex = '(^|/)flux-system/gotk-components\\.yaml$';

export const defaultConfig = {
  fileMatch: [systemManifestRegex],
};

export const supportedDatasources = [
  GithubReleasesDatasource.id,
  HelmDatasource.id,
];
