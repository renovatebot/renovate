import is from '@sindresorhus/is';
import { parsePreset } from '../../../config/presets/parse';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { parseJson } from '../../../util/common';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type { PackageDependency, PackageFileContent } from '../types';

const supportedPresetSources: {
  source: string;
  datasource: string;
}[] = [
  {
    source: 'github',
    datasource: GithubTagsDatasource.id,
  },
  {
    source: 'gitlab',
    datasource: GitlabTagsDatasource.id,
  },
  {
    source: 'gitea',
    datasource: GiteaTagsDatasource.id,
  },
];

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`renovate-config-presets.extractPackageFile(${packageFile})`);
  let config: RenovateConfig | null;
  try {
    config = parseJson(content, packageFile) as RenovateConfig | null;
  } catch {
    logger.debug({ packageFile }, 'Invalid JSON5');
    return null;
  }

  if (is.nullOrUndefined(config)) {
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const preset of config.extends ?? []) {
    const parsedPreset = parsePreset(preset);
    const datasource = supportedPresetSources.find(
      (source) => source.source === parsedPreset.presetSource,
    )?.datasource;

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
