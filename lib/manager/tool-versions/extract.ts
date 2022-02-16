// Based on http://asdf-vm.com/manage/configuration.html#tool-versions
import is from '@sindresorhus/is';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubTagsDatasource } from '../../datasource/github-tags';
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
    datasource: GithubTagsDatasource.id,
    lookupName: 'nodejs/node',
  },
  ruby: {
    datasource: RubyVersionDatasource.id,
    lookupName: 'ruby/ruby',
  },
  python: {
    datasource: GithubTagsDatasource.id,
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
        return is.nonEmptyString(part.trim());
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

      const toolVersionsDep: ToolVersionsDep = supportedDeps[depName];
      parts.shift();

      dep.datasource = toolVersionsDep.datasource;
      if (dep.datasource === GithubTagsDatasource.id) {
        dep.lookupName = toolVersionsDep.lookupName;
      }

      // If we have multiple fallback versions in one line, take only the first one and ignore fallback versions.
      const currentRawValue = parts[0];

      if (currentRawValue === 'system' || currentRawValue.startsWith('path:')) {
        // We do not support updating 'system' or 'path:' deps
        dep = {
          ...dep,
          currentValue: currentRawValue,
          skipReason: 'unsupported-version',
        };
      } else if (currentRawValue.startsWith('ref:')) {
        // The version is a GitHub ref (tag, commit or branch)
        dep = {
          ...dep,
          datasource: GitRefsDatasource.id,
          currentRawValue,
          currentDigest: currentRawValue.substr(refString.length),
          lookupName: `https://github.com/${toolVersionsDep.lookupName}.git`,
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
        dep = {
          ...dep,
          currentValue: currentRawValue,
          skipReason: 'unsupported-version',
        };
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
