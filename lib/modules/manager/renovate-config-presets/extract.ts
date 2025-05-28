import is from '@sindresorhus/is';
import { parsePreset } from '../../../config/presets/parse';
import { logger } from '../../../logger';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type { PackageDependency, PackageFileContent } from '../types';
import { RenovateJsonSchema } from './schema';

const supportedPresetSources: Record<string, string> = {
  github: GithubTagsDatasource.id,
  gitlab: GitlabTagsDatasource.id,
  gitea: GiteaTagsDatasource.id,
};

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`renovate-config-presets.extractPackageFile(${packageFile})`);
  const config = RenovateJsonSchema.safeParse(content);
  if (!config.success) {
    logger.debug({ packageFile, err: config.error }, 'Invalid Renovate Config');
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const preset of config.data.extends ?? []) {
    const parsedPreset = parsePreset(preset);
    const datasource = supportedPresetSources[parsedPreset.presetSource];

    if (is.nullOrUndefined(datasource)) {
      if (parsedPreset.presetSource !== 'internal') {
        deps.push({
          depName: parsedPreset.repo,
          skipReason: 'unsupported-datasource',
        });
      }
      continue;
    }

    if (is.nullOrUndefined(parsedPreset.tag)) {
      deps.push({
        depName: parsedPreset.repo,
        skipReason: 'unspecified-version',
      });
      continue;
    }

    deps.push({
      depName: parsedPreset.repo,
      datasource,
      currentValue: parsedPreset.tag,
    });
  }

  return is.nonEmptyArray(deps) ? { deps } : null;
}
