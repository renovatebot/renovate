import semver from 'semver';
import { regEx } from '../../../util/regex.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { GolangVersionDatasource } from '../../datasource/golang-version/index.ts';
import { isVersion } from '../../versioning/semver/index.ts';
import type { PackageDependency } from '../types.ts';

function trimQuotes(str: string): string {
  return str.replace(regEx(/^"(?<value>.*)"$/), '$<value>');
}

const requireRegex = regEx(
  /^(?<keyword>require)?\s+(?<module>[^\s]+\/?[^\s]+)\s+(?<version>[^\s]+)(?:\s*\/\/\s*(?<comment>.*?)\s*)?$/,
);

const replaceRegex = regEx(
  /^(?<keyword>replace)?\s+(?<module>[^\s]+\/?[^\s]+)\s*=>\s*(?<replacement>[^\s]+)(?:\s+(?<version>[^\s]+))?(?:\s*\/\/\s*(?<comment>.*?)\s*)?$/,
);

export const excludeBlockStartRegex = regEx(/^(?<keyword>exclude)\s+\(\s*$/);

export const endBlockRegex = regEx(/^\s*\)\s*$/);

const toolRegex = regEx(/^(?<keyword>tool)?\s+(?<module>[^\s]+\/?[^\s]+)\s*$/);

const goVersionRegex = regEx(/^\s*go\s+(?<version>[^\s]+)\s*$/);

const toolchainVersionRegex = regEx(/^\s*toolchain\s+go(?<version>[^\s]+)\s*$/);

const pseudoVersionRegex = regEx(GoDatasource.pversionRegexp);

const placeholderPseudoVersion = 'v0.0.0-00010101000000-000000000000';

function extractDigest(input: string): string | undefined {
  const match = pseudoVersionRegex.exec(input);
  return match?.groups?.digest;
}

function isPlaceholderPseudoVersion(version: string): boolean {
  return version === placeholderPseudoVersion;
}

/**
 * Whether the comment marks the dependency as indirect, the same way Go reads
 * it: `// indirect`, or `// indirect; <note>` when the line carries a note.
 */
function isIndirect(comment: string | undefined): boolean {
  return comment === 'indirect' || !!comment?.startsWith('indirect;');
}

const followBranchRegex = regEx(
  /^(?:indirect;\s*)?renovate:\s*branch=(?<branch>\S+)$/,
);

/**
 * A pseudo-version marked with `// renovate: branch=<name>` follows the
 * commits of that branch, like a `@<sha> # <branch>` pin in GitHub Actions.
 * The branch becomes the value, which the default `semver` versioning of the
 * `go` datasource does not read as a version, so the lookup only proposes
 * digest updates and never switches to a release.
 */
function followBranch(
  dep: PackageDependency,
  comment: string | undefined,
): void {
  const branch = comment
    ? followBranchRegex.exec(comment)?.groups?.branch
    : undefined;
  if (branch && dep.currentDigest && !dep.skipReason) {
    dep.currentValue = branch;
    delete dep.versioning;
  }
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
      commitMessageTopic: 'go module directive',
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
      commitMessageTopic: 'go toolchain directive',
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
        if (isPlaceholderPseudoVersion(currentValue)) {
          dep.skipReason = 'invalid-version';
        }
      }
    } else {
      dep.skipReason = 'invalid-version';
    }

    if (isIndirect(comment)) {
      dep.depType = 'indirect';
      dep.enabled = false;
    }

    followBranch(dep, comment);

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
        if (isPlaceholderPseudoVersion(currentValue)) {
          dep.skipReason = 'invalid-version';
        }
      }
    } else if (currentValue) {
      dep.skipReason = 'invalid-version';
    } else {
      dep.skipReason = 'unspecified-version';
      delete dep.currentValue;
    }

    if (isIndirect(comment)) {
      dep.depType = 'indirect';
      dep.enabled = false;
    }

    followBranch(dep, comment);

    if (!keyword) {
      dep.managerData = { multiLine: true };
    }

    if (depName.startsWith('/') || depName.startsWith('.')) {
      dep.skipReason = 'local-dependency';
    }

    return dep;
  }

  const toolMatches = toolRegex.exec(input)?.groups;
  if (toolMatches) {
    const { keyword, module } = toolMatches;

    const depName = trimQuotes(module);

    const dep: PackageDependency = {
      datasource: GoDatasource.id,
      depType: 'tool',
      depName,
      skipReason: 'unversioned-reference',
    };

    if (!keyword) {
      dep.managerData = { multiLine: true };
    }

    return dep;
  }

  return null;
}
