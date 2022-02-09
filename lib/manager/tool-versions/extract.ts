// Based on http://asdf-vm.com/manage/configuration.html#tool-versions
import * as NpmDatasource from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import { logger } from '../../logger';
import { isSkipComment } from '../../util/ignore';
import { newlineRegex, regEx } from '../../util/regex';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

const whiteSpaceRegex = regEx(`(\\s+)`);
const refString = 'ref:';

// Mapping between supported dependency names and their datasources
const supportedDeps: Record<string, string> = {
  nodejs: NpmDatasource.id,
  ruby: RubyVersionDatasource.id,
  python: PypiDatasource.id,
};

export function extractPackageFile(
  content: string,
  _: string,
  config: ExtractConfig
): PackageFile | null {
  logger.trace('tool_versions.extractPackageFile()');

  const deps = content
    .split(newlineRegex)
    .map((rawline) => {
      const dep: PackageDependency = {};
      const [line, comment] = rawline.split('#').map((part) => part.trim());
      if (isSkipComment(comment)) {
        dep.skipReason = 'ignored';
      }

      // Each line is in format "depName version [...fallbackVersion]"
      const parts = line.split(whiteSpaceRegex).filter(function (part) {
        return part.trim().length > 0;
      });

      if (parts.length < 2) {
        // Wrong line format
        logger.debug({ line }, 'Wrong/unsupported line format');
        return null;
      }

      const depName = parts[0];
      dep.depName = depName;

      // Check if the datasource for this dependency is known to us
      if (!supportedDeps[depName]) {
        logger.debug(
          { depName },
          "The datasource for this dependency can't be determined"
        );
        dep.skipReason = 'unsupported-datasource';
        return dep;
      }
      dep.datasource = supportedDeps[depName];
      parts.shift();

      // If we have multiple fallback versions in one line, take only the first one and ignore fallback versions.
      const currentValue = parts[0];
      dep.currentValue = currentValue;

      if (currentValue === 'system' || currentValue.startsWith('path:')) {
        // We do not support updating 'system' or 'path:' deps
        dep.skipReason = 'unsupported-version';
      } else if (currentValue.startsWith('ref:')) {
        // The version is a tag or branch name
        dep.currentDigest = currentValue.substr(refString.length);
      }

      return dep;
    })
    .filter(Boolean);

  if (!deps.length) {
    return null;
  }

  const res: PackageFile = { deps };
  return res;
}
