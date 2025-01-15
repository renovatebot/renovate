import { regEx } from '../../../util/regex';
import type { HelmRepository } from './schema';
import type { FluxManifest } from './types';

export const systemManifestFileNameRegex = '(?:^|/)gotk-components\\.ya?ml$';

export const systemManifestHeaderRegex =
  '#\\s*Flux\\s+Version:\\s*(\\S+)(?:\\s*#\\s*Components:\\s*([A-Za-z,-]+))?';

export function isSystemManifest(file: string): boolean {
  return regEx(systemManifestFileNameRegex).test(file);
}

export function collectHelmRepos(manifests: FluxManifest[]): HelmRepository[] {
  const helmRepositories: HelmRepository[] = [];

  for (const manifest of manifests) {
    if (manifest.kind === 'resource') {
      for (const resource of manifest.resources) {
        if (resource.kind === 'HelmRepository') {
          helmRepositories.push(resource);
        }
      }
    }
  }

  return helmRepositories;
}
