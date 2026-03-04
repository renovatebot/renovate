import { isNonEmptyArray, isNullOrUndefined } from '@sindresorhus/is';
import { parsePreset } from '../../../config/presets/parse.ts';
import { logger } from '../../../logger/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { RenovateJson } from './schema.ts';

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
  const config = RenovateJson.safeParse(content);
  if (!config.success) {
    logger.debug({ packageFile, err: config.error }, 'Invalid Renovate Config');
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const preset of config.data.extends ?? []) {
    const parsedPreset = parsePreset(preset);
    const datasource = supportedPresetSources[parsedPreset.presetSource];

    if (isNullOrUndefined(datasource)) {
      if (parsedPreset.presetSource !== 'internal') {
        deps.push({
          depName: parsedPreset.repo,
          skipReason: 'unsupported-datasource',
        });
      }
      continue;
    }

    if (isNullOrUndefined(parsedPreset.tag)) {
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

  return isNonEmptyArray(deps) ? { deps } : null;
}
