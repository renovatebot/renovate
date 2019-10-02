// based on https://www.python.org/dev/peps/pep-0508/#names
import { RANGE_PATTERN as rangePattern } from '@renovate/pep440/lib/specifier';
import { logger } from '../../logger';
import { isSkipComment } from '../../util/ignore';
import { isValid, isSingleVersion } from '../../versioning/pep440';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';

export const packagePattern =
  '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';

const specifierPartPattern = `\\s*${rangePattern.replace(/\?<\w+>/g, '?:')}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
export const dependencyPattern = `(?<depName>${packagePattern})(${extrasPattern})(?<currentValue>${specifierPattern})`;

const digestsRegex = new RegExp(`--hash=(sha256|md5):[a-fA-F0-9]+`, 'g');

function extractDigests(line: string): string[] {
  const match = line.match(digestsRegex) || [];
  return match.map(arg => arg.replace('--hash=', ''));
}

export function extractPackageFile(
  content: string,
  _: string,
  config: ExtractConfig
): PackageFile | null {
  logger.trace('pip_requirements.extractPackageFile()');

  let indexUrl: string;
  const extraUrls = [];
  content.split('\n').forEach(line => {
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
  } else if (config.registryUrls && config.registryUrls.length) {
    // configured registryURls takes next precedence
    registryUrls = registryUrls.concat(config.registryUrls);
  } else if (extraUrls.length) {
    // Use default registry first if extra URLs are present and index URL is not
    registryUrls.push('https://pypi.org/pypi/');
  }
  registryUrls = registryUrls.concat(extraUrls);

  const regex = new RegExp(`^${dependencyPattern}$`, 'g');
  const deps = [];
  const lines = content.split('\n');

  let dep: PackageDependency = null;
  let digests: string[] = [];
  const flush = () => {
    if (dep) {
      const digestCount = digests.length;
      if (digestCount === 1) {
        deps.push({ ...dep, currentDigest: digests[0] });
      } else if (digestCount > 1) {
        digests
          .map(currentDigest => ({
            ...dep,
            currentDigest,
            groupName: dep.depName,
          }))
          .forEach(d => deps.push(d));
      } else {
        deps.push(dep);
      }
    }
    dep = null;
    digests = [];
  };

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const rawline = lines[lineNumber].replace(/\s*\\$/, '');
    const [line, comment] = rawline.split('#').map(part => part.trim());

    regex.lastIndex = 0;
    const matches = regex.exec(line);
    if (matches) {
      flush();
      const { depName, currentValue } = matches.groups;

      dep = {
        depName,
        currentValue,
        managerData: { lineNumber },
        datasource: 'pypi',
      };

      if (isSkipComment(comment)) {
        dep.skipReason = 'ignored';
      }

      if (
        isValid(currentValue) &&
        isSingleVersion(currentValue) &&
        currentValue.startsWith('==')
      ) {
        dep.fromVersion = currentValue.replace(/^==/, '');
      }
    }

    digests = [...digests, ...extractDigests(line)];
  }
  flush();

  if (!deps.length) {
    return null;
  }
  const res: PackageFile = { deps };
  if (registryUrls.length > 0) {
    res.registryUrls = registryUrls;
  }

  return res;
}
