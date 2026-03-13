import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const githubUrlRegExp = regEx(
  /^(?:https?:\/\/github\.com\/|git@github\.com:|git:\/\/github\.com\/)(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/,
);

const commentRegExp = regEx(/%.*$/);

// Matches bare atom: cowboy
const bareAtomRegExp = regEx(/^\s*(\w+)\s*$/);

// Matches hex dep with version: {cowboy, "~> 2.9"}
const hexDepRegExp = regEx(/^\s*\{\s*(\w+)\s*,\s*"([^"]+)"\s*\}\s*$/);

// Matches hex dep with version and pkg override: {telemetry, "~> 1.0", {pkg, my_telemetry}}
const hexDepWithPkgRegExp = regEx(
  /^\s*\{\s*(\w+)\s*,\s*"([^"]+)"\s*,\s*\{pkg\s*,\s*(\w+)\}\s*\}\s*$/,
);

// Matches hex dep with pkg override (no version): {pgo, {pkg, pgo_fork}}
const hexDepPkgOnlyRegExp = regEx(
  /^\s*\{\s*(\w+)\s*,\s*\{pkg\s*,\s*(\w+)\}\s*\}\s*$/,
);

// Matches git dep: {nova, {git, "url", {tag|branch|ref, "value"}}}
const gitDepRegExp = regEx(
  /^\s*\{\s*(\w+)\s*,\s*\{(git|git_subdir)\s*,\s*"([^"]+)"\s*,\s*\{(tag|branch|ref)\s*,\s*"([^"]+)"\}(?:\s*,\s*"[^"]*")?\s*\}\s*\}\s*$/,
);

// Matches git dep without ref: {sumo_db, {git, "url"}}
const gitDepNoRefRegExp = regEx(
  /^\s*\{\s*(\w+)\s*,\s*\{(git|git_subdir)\s*,\s*"([^"]+)"\s*\}\s*\}\s*$/,
);

// Lock file patterns (global + multiline-safe via \s*)
const lockVersionRegExp = regEx(
  /\{<<"(\w+)">>\s*,\s*\{pkg\s*,\s*<<"[^"]*">>\s*,\s*<<"([^"]+)">>\}\s*,\s*\d+\}/g,
);

const lockGitRefRegExp = regEx(
  /\{<<"(\w+)">>\s*,\s*\{git\s*,\s*"[^"]+"\s*,\s*\{ref\s*,\s*"([^"]+)"\}\s*\}\s*,\s*\d+\}/g,
);

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = githubUrlRegExp.exec(url);
  if (match?.groups) {
    return { owner: match.groups.owner, repo: match.groups.repo };
  }
  return null;
}

function parseDep(line: string): PackageDependency | null {
  // Try git dep with ref/tag/branch
  let match = gitDepRegExp.exec(line);
  if (match) {
    const [, name, , url, refType, refValue] = match;
    const dep: PackageDependency = {
      depName: name,
      depType: 'prod',
    };

    const github = parseGithubUrl(url);
    if (github) {
      dep.datasource = GithubTagsDatasource.id;
      dep.packageName = `${github.owner}/${github.repo}`;
    } else {
      dep.datasource = GitTagsDatasource.id;
      dep.packageName = url;
    }

    if (refType === 'tag') {
      dep.currentValue = refValue;
    } else if (refType === 'branch') {
      dep.currentValue = refValue;
    } else {
      // ref (commit hash)
      dep.currentDigest = refValue;
    }

    return dep;
  }

  // Try git dep without ref
  match = gitDepNoRefRegExp.exec(line);
  if (match) {
    const [, name, , url] = match;
    const dep: PackageDependency = {
      depName: name,
      depType: 'prod',
      skipReason: 'unspecified-version',
    };

    const github = parseGithubUrl(url);
    if (github) {
      dep.datasource = GithubTagsDatasource.id;
      dep.packageName = `${github.owner}/${github.repo}`;
    } else {
      dep.datasource = GitTagsDatasource.id;
      dep.packageName = url;
    }

    return dep;
  }

  // Try hex dep with version and pkg override
  match = hexDepWithPkgRegExp.exec(line);
  if (match) {
    const [, name, version, pkg] = match;
    return {
      depName: name,
      currentValue: version,
      datasource: HexDatasource.id,
      packageName: pkg,
      depType: 'prod',
    };
  }

  // Try hex dep with pkg only (no version)
  match = hexDepPkgOnlyRegExp.exec(line);
  if (match) {
    const [, name, pkg] = match;
    return {
      depName: name,
      datasource: HexDatasource.id,
      packageName: pkg,
      depType: 'prod',
      skipReason: 'unspecified-version',
    };
  }

  // Try hex dep with version
  match = hexDepRegExp.exec(line);
  if (match) {
    const [, name, version] = match;
    const dep: PackageDependency = {
      depName: name,
      currentValue: version,
      datasource: HexDatasource.id,
      packageName: name,
      depType: 'prod',
    };
    if (version.startsWith('==')) {
      dep.currentVersion = version.replace(regEx(/^==\s*/), '');
    }
    return dep;
  }

  // Try bare atom (latest version)
  match = bareAtomRegExp.exec(line);
  if (match) {
    const [, name] = match;
    // Skip Erlang keywords that might appear in config
    if (['end', 'true', 'false', 'undefined'].includes(name)) {
      return null;
    }
    return {
      depName: name,
      datasource: HexDatasource.id,
      packageName: name,
      depType: 'prod',
      skipReason: 'unspecified-version',
    };
  }

  return null;
}

function extractDepsSection(content: string): string[] {
  const depSections: string[] = [];
  const lines = content.split(newlineRegex);

  let inDeps = false;
  let bracketDepth = 0;
  let buffer = '';

  for (const rawLine of lines) {
    const line = rawLine.replace(commentRegExp, '');

    if (!inDeps) {
      // Match both top-level {deps, [...]} and profile deps
      if (regEx(/\{deps\s*,\s*\[/).test(line)) {
        inDeps = true;
        bracketDepth = 0;
        // Count brackets from the deps start
        for (const ch of line.substring(line.indexOf('[') + 1)) {
          if (ch === '[') {
            bracketDepth++;
          }
          if (ch === ']') {
            bracketDepth--;
          }
        }
        buffer = line.substring(line.indexOf('[') + 1);
        if (bracketDepth < 0) {
          // Closed on same line
          depSections.push(buffer);
          inDeps = false;
          buffer = '';
        }
        continue;
      }
      continue;
    }

    for (const ch of line) {
      if (ch === '[') {
        bracketDepth++;
      }
      if (ch === ']') {
        bracketDepth--;
      }
    }

    if (bracketDepth < 0) {
      // Remove trailing ] and beyond
      const closingIdx = line.lastIndexOf(']');
      buffer += line.substring(0, closingIdx);
      depSections.push(buffer);
      inDeps = false;
      buffer = '';
    } else {
      buffer += line + '\n';
    }
  }

  return depSections;
}

function splitDepEntries(depsContent: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of depsContent) {
    if (ch === '{') {
      depth++;
      current += ch;
    } else if (ch === '}') {
      depth--;
      current += ch;
      if (depth === 0) {
        entries.push(current.trim());
        current = '';
      }
    } else if (depth === 0 && ch === ',') {
      // Bare atom separator at top level
      const trimmed = current.trim();
      if (trimmed) {
        entries.push(trimmed);
      }
      current = '';
    } else {
      current += ch;
    }
  }

  // Handle trailing bare atom
  const trimmed = current.trim();
  if (trimmed) {
    entries.push(trimmed);
  }

  return entries;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`rebar3.extractPackageFile(${packageFile})`);
  const deps = new Map<string, PackageDependency>();

  const depSections = extractDepsSection(content);
  if (depSections.length === 0) {
    return null;
  }

  let isTestProfile = false;
  const lines = content.split(newlineRegex);
  let testProfileStart = -1;

  // Find where test profile deps start
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(commentRegExp, '');
    if (regEx(/\{test\s*,/).test(line)) {
      testProfileStart = i;
    }
  }

  for (const section of depSections) {
    // Determine if this section is inside a test profile
    // by checking if it appears after the test profile marker
    const sectionFirstLine = section.split(newlineRegex)[0] ?? '';
    const sectionIdx = content.indexOf(sectionFirstLine);
    if (testProfileStart >= 0) {
      const testProfileOffset = lines
        .slice(0, testProfileStart)
        .join('\n').length;
      isTestProfile = sectionIdx > testProfileOffset;
    }

    const entries = splitDepEntries(section);
    for (const entry of entries) {
      const dep = parseDep(entry);
      if (dep) {
        if (isTestProfile) {
          dep.depType = 'test';
        }
        deps.set(dep.depName!, dep);
      }
    }
  }

  // Read lock file for locked versions
  const lockFileName =
    (await findLocalSiblingOrParent(packageFile, 'rebar.lock')) ?? 'rebar.lock';
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (lockFileContent) {
    // Match against the full content to handle multiline entries
    let lockMatch;

    lockVersionRegExp.lastIndex = 0;
    while ((lockMatch = lockVersionRegExp.exec(lockFileContent)) !== null) {
      const dep = deps.get(lockMatch[1]);
      if (dep) {
        dep.lockedVersion = lockMatch[2];
      }
    }

    lockGitRefRegExp.lastIndex = 0;
    while ((lockMatch = lockGitRefRegExp.exec(lockFileContent)) !== null) {
      const dep = deps.get(lockMatch[1]);
      if (dep && !dep.currentDigest) {
        dep.currentDigest = lockMatch[2];
      }
    }
  }

  const depsArray = Array.from(deps.values());
  if (depsArray.length === 0) {
    return null;
  }
  return {
    deps: depsArray,
    lockFiles: lockFileContent ? [lockFileName] : undefined,
  };
}
