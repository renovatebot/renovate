import type { UpdateArtifactsConfig } from '../lib/modules/manager/types.ts';
import { applyRepoConfigDefaults } from '../lib/workers/repository/init/defaults.ts';

/**
 * Builds an {@link UpdateArtifactsConfig} with the defaults of the options which the branch config always has, and `overrides` on top.
 */
export function updateArtifactsConfig(
  overrides: Partial<UpdateArtifactsConfig> = {},
): UpdateArtifactsConfig {
  const {
    goGetDirs,
    ignorePlugins,
    ignoreScripts,
    postUpdateOptions,
    registryAliases,
    skipArtifactsUpdate,
  } = applyRepoConfigDefaults({});
  return {
    goGetDirs,
    ignorePlugins,
    ignoreScripts,
    postUpdateOptions,
    registryAliases,
    skipArtifactsUpdate,
    ...overrides,
  };
}
