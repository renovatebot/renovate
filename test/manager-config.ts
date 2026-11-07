import type {
  DefaultedExtractConfig,
  UpdateArtifactsConfig,
} from '../lib/modules/manager/types.ts';
import { applyRepoConfigDefaults } from '../lib/workers/repository/init/defaults.ts';

/**
 * Builds a {@link DefaultedExtractConfig} with the defaults of the options which the extract config always has, and `overrides` on top.
 */
export function extractConfig(
  overrides: Partial<DefaultedExtractConfig> = {},
): DefaultedExtractConfig {
  const { registryAliases } = applyRepoConfigDefaults({});
  return { registryAliases, ...overrides };
}

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
