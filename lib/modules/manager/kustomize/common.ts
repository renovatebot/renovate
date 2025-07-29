import semver from 'semver';
import upath from 'upath';
import type { ExtraEnv } from '../../../util/exec/types';
import { privateCacheDir } from '../../../util/fs';
import type { UpdateArtifactsConfig } from '../types';

export function generateHelmEnvs(config: UpdateArtifactsConfig): ExtraEnv {
  const cacheDir = privateCacheDir();

  const envs: ExtraEnv = {
    // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
    HELM_REGISTRY_CONFIG: upath.join(cacheDir, 'registry.json'),
    HELM_REPOSITORY_CONFIG: upath.join(cacheDir, 'repositories.yaml'),
    HELM_REPOSITORY_CACHE: upath.join(cacheDir, 'repositories'),
  };

  if (
    config.constraints?.helm &&
    !semver.intersects(config.constraints.helm, '>=3.8.0')
  ) {
    envs.HELM_EXPERIMENTAL_OCI = '1';
  }

  return envs;
}
