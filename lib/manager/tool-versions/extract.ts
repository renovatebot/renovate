// Based on http://asdf-vm.com/manage/configuration.html#tool-versions
import * as GitHubTagsDatasource from '../../datasource/github-tags';
import * as NpmDatasource from '../../datasource/npm';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import { logger } from '../../logger';
import { isSkipComment } from '../../util/ignore';
import { newlineRegex, regEx } from '../../util/regex';
import * as semverCoerced from '../../versioning/semver-coerced';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { ToolVersionsDep } from './types';

const whiteSpaceRegex = regEx(`(\\s+)`);
const refString = 'ref:';

// Mapping between supported dependency names and their datasources/lookup names
const supportedDeps: Record<string, ToolVersionsDep> = {
  nodejs: {
    datasource: NpmDatasource.id,
    depName: 'node',
    lookupName: 'nodejs',
  },
  ruby: {
    datasource: RubyVersionDatasource.id,
    lookupName: 'ruby/ruby',
  },
  python: {
    datasource: GitHubTagsDatasource.id,
    lookupName: 'python/cpython',
  },
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
      let dep: PackageDependency = {};
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

      dep.depName = supportedDeps[depName]?.depName ?? depName;

      // Check if the datasource for this dependency is known to us
      if (!supportedDeps[depName]) {
        logger.debug(
          { depName },
          "The datasource for this dependency can't be determined"
        );
        dep.skipReason = 'unsupported-datasource';
        return dep;
      }

      const toolVersionsDep: ToolVersionsDep = supportedDeps[depName];

      dep.datasource = toolVersionsDep.datasource;
      if (dep.datasource === GitHubTagsDatasource.id) {
        dep.lookupName = toolVersionsDep.lookupName;
      }

      parts.shift();

      // If we have multiple fallback versions in one line, take only the first one and ignore fallback versions.
      const currentRawValue = parts[0];

      if (currentRawValue === 'system' || currentRawValue.startsWith('path:')) {
        // We do not support updating 'system' or 'path:' deps
        dep.currentValue = currentRawValue;
        dep.skipReason = 'unsupported-version';
      } else if (currentRawValue.startsWith('ref:')) {
        // The version is a tag or branch name
        dep = {
          ...dep,
          datasource: GitHubTagsDatasource.id,
          currentRawValue,
          currentDigest: currentRawValue.substr(refString.length),
          lookupName: toolVersionsDep.lookupName,
        };
      } else if (semverCoerced.isVersion(currentRawValue)) {
        // The version is semver-like
        dep = {
          ...dep,
          currentValue: currentRawValue,
          currentVersion: currentRawValue,
        };
      } else {
        logger.debug(
          { currentRawValue },
          'Not a well-formed or supported version'
        );
        dep.currentValue = currentRawValue;
        dep.skipReason = 'unsupported-version';
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
