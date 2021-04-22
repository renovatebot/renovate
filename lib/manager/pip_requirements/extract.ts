// based on https://www.python.org/dev/peps/pep-0508/#names
import { RANGE_PATTERN } from '@renovate/pep440/lib/specifier';
import { getAdminConfig } from '../../config/admin';
import * as datasourcePypi from '../../datasource/pypi';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isSkipComment } from '../../util/ignore';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export const packagePattern =
  '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';

const rangePattern: string = RANGE_PATTERN;
const specifierPartPattern = `\\s*${rangePattern.replace(/\?<\w+>/g, '?:')}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
export const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;

export function extractPackageFile(
  content: string,
  _: string,
  config: ExtractConfig
): PackageFile | null {
  logger.trace('pip_requirements.extractPackageFile()');

  let indexUrl: string;
  const extraUrls = [];
  content.split('\n').forEach((line) => {
    if (line.startsWith('--index-url ')) {
      indexUrl = line.substring('--index-url '.length).split(' ')[0];
    }
    if (line.startsWith('--extra-index-url ')) {
      const extraUrl = line
        .substring('--extra-index-url '.length)
        .split(' ')[0];
      extraUrls.push(extraUrl);
    }
  });
  let registryUrls: string[] = [];
  if (indexUrl) {
    // index url in file takes precedence
    registryUrls.push(indexUrl);
  } else if (config.registryUrls?.length) {
    // configured registryURls takes next precedence
    registryUrls = registryUrls.concat(config.registryUrls);
  } else if (extraUrls.length) {
    // Use default registry first if extra URLs are present and index URL is not
    registryUrls.push(process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/');
  }
  registryUrls = registryUrls.concat(extraUrls);

  const regex = new RegExp(`^${dependencyPattern}$`, 'g');
  const deps = content
    .split('\n')
    .map((rawline) => {
      let dep: PackageDependency = {};
      const [line, comment] = rawline.split('#').map((part) => part.trim());
      if (isSkipComment(comment)) {
        dep.skipReason = SkipReason.Ignored;
      }
      regex.lastIndex = 0;
      const matches = regex.exec(line.split(' \\')[0]);
      if (!matches) {
        return null;
      }
      const [, depName, , currentValue] = matches;
      dep = {
        ...dep,
        depName,
        currentValue,
        datasource: datasourcePypi.id,
      };
      if (currentValue?.startsWith('==')) {
        dep.currentVersion = currentValue.replace(/^==/, '');
      }
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  const res: PackageFile = { deps };
  if (registryUrls.length > 0) {
    res.registryUrls = registryUrls.map((url) => {
      // handle the optional quotes in eg. `--extra-index-url "https://foo.bar"`
      const cleaned = url.replace(/^"/, '').replace(/"$/, '');
      if (!getAdminConfig().exposeAllEnv) {
        return cleaned;
      }
      // interpolate any environment variables
      return cleaned.replace(
        /(\$[A-Za-z\d_]+)|(\${[A-Za-z\d_]+})/g,
        (match) => {
          const envvar = match.substring(1).replace(/^{/, '').replace(/}$/, '');
          const sub = process.env[envvar];
          return sub || match;
        }
      );
    });
  }
  return res;
}
