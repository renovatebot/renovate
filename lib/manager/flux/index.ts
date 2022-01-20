import { id as GithubReleasesId } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';
export { extractAllPackageFiles, extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

const systemManifestRegex = '(^|/)flux-system/gotk-components\\.yaml$';
export function isSystemManifest(file: string): boolean {
  return new RegExp(systemManifestRegex).test(file);
}
export const defaultConfig = {
  fileMatch: [systemManifestRegex],
};

export const supportedDatasources = [GithubReleasesId, HelmDatasource.id];
