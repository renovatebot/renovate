import semver from 'semver';
import { regEx } from '../../../util/regex';
import { GoDatasource } from '../../datasource/go';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import { isVersion } from '../../versioning/semver';
import type { PackageDependency } from '../types';

function trimQuotes(str: string): string {
  return str.replace(regEx(/^"(.*)"$/), '$1');
}

const requireRegex = regEx(
  /^(?<keyword>require)?\s+(?<module>[^\s]+\/?[^\s]+)\s+(?<version>[^\s]+)(?:\s*\/\/\s*(?<comment>[^\s]+)\s*)?$/,
);

const replaceRegex = regEx(
  /^(?<keyword>replace)?\s+(?<module>[^\s]+\/[^\s]+)\s*=>\s*(?<replacement>[^\s]+)(?:\s+(?<version>[^\s]+))?(?:\s*\/\/\s*(?<comment>[^\s]+)\s*)?$/,
);

const goVersionRegex = regEx(/^\s*go\s+(?<version>[^\s]+)\s*$/);

const toolchainVersionRegex = regEx(/^\s*toolchain\s+go(?<version>[^\s]+)\s*$/);

const pseudoVersionRegex = regEx(GoDatasource.pversionRegexp);

function extractDigest(input: string): string | undefined {
  const match = pseudoVersionRegex.exec(input);
  return match?.groups?.digest;
}

export function parseLine(input: string): PackageDependency | null {
  const goVersionMatches = goVersionRegex.exec(input)?.groups;
  if (goVersionMatches) {
    const { version: currentValue } = goVersionMatches;

    const dep: PackageDependency = {
      datasource: GolangVersionDatasource.id,
      versioning: 'go-mod-directive',
      depType: 'golang',
      depName: 'go',
      currentValue,
    };

    if (!semver.validRange(currentValue)) {
      dep.skipReason = 'invalid-version';
    }

    return dep;
  }

  const toolchainMatches = toolchainVersionRegex.exec(input)?.groups;
  if (toolchainMatches) {
    const { version: currentValue } = toolchainMatches;

    const dep: PackageDependency = {
      datasource: GolangVersionDatasource.id,
      depType: 'toolchain',
      depName: 'go',
      currentValue,
    };

    if (!semver.valid(currentValue)) {
      dep.skipReason = 'invalid-version';
    }

    return dep;
  }

  const requireMatches = requireRegex.exec(input)?.groups;
  if (requireMatches) {
    const { keyword, module, version: currentValue, comment } = requireMatches;

    const depName = trimQuotes(module);

    const dep: PackageDependency = {
      datasource: GoDatasource.id,
      depType: 'require',
      depName,
      currentValue,
    };

    if (isVersion(currentValue)) {
      const digest = extractDigest(currentValue);
      if (digest) {
        dep.currentDigest = digest;
        dep.digestOneAndOnly = true;
        dep.versioning = 'loose';
      }
    } else {
      dep.skipReason = 'invalid-version';
    }

    if (comment === 'indirect') {
      dep.depType = 'indirect';
      dep.enabled = false;
    }

    if (!keyword) {
      dep.managerData = { multiLine: true };
    }

    return dep;
  }

  const replaceMatches = replaceRegex.exec(input)?.groups;
  if (replaceMatches) {
    const {
      keyword,
      replacement,
      version: currentValue,
      comment,
    } = replaceMatches;

    const depName = trimQuotes(replacement);

    const dep: PackageDependency = {
      datasource: GoDatasource.id,
      depType: 'replace',
      depName,
      currentValue,
    };

    if (isVersion(currentValue)) {
      const digest = extractDigest(currentValue);
      if (digest) {
        dep.currentDigest = digest;
        dep.digestOneAndOnly = true;
        dep.versioning = 'loose';
      }
    } else if (currentValue) {
      dep.skipReason = 'invalid-version';
    } else {
      dep.skipReason = 'unspecified-version';
      delete dep.currentValue;
    }

    if (comment === 'indirect') {
      dep.depType = 'indirect';
      dep.enabled = false;
    }

    if (!keyword) {
      dep.managerData = { multiLine: true };
    }

    if (depName.startsWith('/') || depName.startsWith('.')) {
      dep.skipReason = 'local-dependency';
    }

    return dep;
  }

  return null;
}
