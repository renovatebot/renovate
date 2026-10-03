import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const githubUrlRegExp = regEx(
  /^(?:https?:\/\/github\.com\/|git@github\.com:|git:\/\/github\.com\/)(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/,
);

// Matches the atom at the head of a tuple: the `deps` in `{deps, [`. Profile
// names needing quotes, such as `{'int-test', [...]}`, are matched unquoted.
const tupleTagRegExp = regEx(/^\s*'?(?<tag>[a-z][a-zA-Z\d_@-]*)'?\s*,/);

// Matches bare atom: cowboy
const bareAtomRegExp = regEx(/^\s*(?<name>\w+)\s*$/);

// Matches hex dep with version: {cowboy, "~> 2.9"}
const hexDepRegExp = regEx(
  /^\s*\{\s*(?<name>\w+)\s*,\s*"(?<version>[^"]+)"\s*\}\s*$/,
);

// Matches hex dep with version and pkg override: {telemetry, "~> 1.0", {pkg, my_telemetry}}
const hexDepWithPkgRegExp = regEx(
  /^\s*\{\s*(?<name>\w+)\s*,\s*"(?<version>[^"]+)"\s*,\s*\{pkg\s*,\s*(?<pkg>\w+)\}\s*\}\s*$/,
);

// Matches hex dep with pkg override (no version): {pgo, {pkg, pgo_fork}}
const hexDepPkgOnlyRegExp = regEx(
  /^\s*\{\s*(?<name>\w+)\s*,\s*\{pkg\s*,\s*(?<pkg>\w+)\}\s*\}\s*$/,
);

// Matches git dep: {nova, {git, "url", {tag|branch|ref, "value"}}}
const gitDepRegExp = regEx(
  /^\s*\{\s*(?<name>\w+)\s*,\s*\{(?:git|git_subdir)\s*,\s*"(?<url>[^"]+)"\s*,\s*\{(?<refType>tag|branch|ref)\s*,\s*"(?<refValue>[^"]+)"\}(?:\s*,\s*"[^"]*")?\s*\}\s*\}\s*$/,
);

// Matches git dep without ref: {sumo_db, {git, "url"}}
const gitDepNoRefRegExp = regEx(
  /^\s*\{\s*(?<name>\w+)\s*,\s*\{(?:git|git_subdir)\s*,\s*"(?<url>[^"]+)"\s*\}\s*\}\s*$/,
);

// Lock file patterns (global + multiline-safe via \s*)
const lockVersionRegExp = regEx(
  /\{<<"(?<name>\w+)">>\s*,\s*\{pkg\s*,\s*<<"[^"]*">>\s*,\s*<<"(?<version>[^"]+)">>\}\s*,\s*\d+\}/g,
);

const exactVersionPrefixRegExp = regEx(/^==\s*/);

// Erlang literals that are never dependency names
const erlangKeywords = new Set(['end', 'true', 'false', 'undefined']);

function gitSource(
  url: string,
): Pick<PackageDependency, 'datasource' | 'packageName'> {
  const github = githubUrlRegExp.exec(url)?.groups;
  if (github) {
    return {
      datasource: GithubTagsDatasource.id,
      packageName: `${github.owner}/${github.repo}`,
    };
  }
  return { datasource: GitTagsDatasource.id, packageName: url };
}

function parseDep(line: string): PackageDependency | null {
  // Try git dep with ref/tag/branch
  let groups = gitDepRegExp.exec(line)?.groups;
  if (groups) {
    const { name, url, refType, refValue } = groups;
    const dep: PackageDependency = {
      depName: name,
      ...gitSource(url),
    };

    if (refType === 'tag' || refType === 'branch') {
      dep.currentValue = refValue;
    } else {
      // ref (commit hash)
      dep.currentDigest = refValue;
    }

    return dep;
  }

  // Try git dep without ref
  groups = gitDepNoRefRegExp.exec(line)?.groups;
  if (groups) {
    const { name, url } = groups;
    return {
      depName: name,
      skipReason: 'unspecified-version',
      ...gitSource(url),
    };
  }

  // Try hex dep with version and pkg override
  groups = hexDepWithPkgRegExp.exec(line)?.groups;
  if (groups) {
    const { name, version, pkg } = groups;
    return {
      depName: name,
      currentValue: version,
      datasource: HexDatasource.id,
      packageName: pkg,
    };
  }

  // Try hex dep with pkg only (no version)
  groups = hexDepPkgOnlyRegExp.exec(line)?.groups;
  if (groups) {
    const { name, pkg } = groups;
    return {
      depName: name,
      datasource: HexDatasource.id,
      packageName: pkg,
      skipReason: 'unspecified-version',
    };
  }

  // Try hex dep with version
  groups = hexDepRegExp.exec(line)?.groups;
  if (groups) {
    const { name, version } = groups;
    const dep: PackageDependency = {
      depName: name,
      currentValue: version,
      datasource: HexDatasource.id,
      packageName: name,
    };
    if (version.startsWith('==')) {
      dep.currentVersion = version.replace(exactVersionPrefixRegExp, '');
    }
    return dep;
  }

  // Try bare atom (latest version)
  groups = bareAtomRegExp.exec(line)?.groups;
  if (groups) {
    const { name } = groups;
    // Skip Erlang keywords that might appear in config
    if (erlangKeywords.has(name)) {
      return null;
    }
    return {
      depName: name,
      datasource: HexDatasource.id,
      packageName: name,
      skipReason: 'unspecified-version',
    };
  }

  logger.debug({ line }, 'rebar: unrecognised dependency entry');
  return null;
}

// `%` only starts a comment outside a quoted string, otherwise a percent-encoded
// URL such as `.../My%20Project/_git/app` truncates the line and unbalances the
// bracket counting for everything that follows.
function stripComments(content: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  let inComment = false;

  for (const ch of content) {
    if (inComment) {
      if (ch === '\n') {
        inComment = false;
        result += ch;
      }
    } else if (escaped) {
      escaped = false;
      result += ch;
    } else if (inString) {
      escaped = ch === '\\';
      inString = ch !== '"';
      result += ch;
    } else if (ch === '%') {
      inComment = true;
    } else {
      inString = ch === '"';
      result += ch;
    }
  }

  return result;
}

interface DepsSection {
  content: string;
  profile?: string;
}

interface OpenTerm {
  bracket: '{' | '[';
  tag?: string;
  start: number;
}

// The profile a deps list belongs to is the tuple tag directly inside
// `{profiles, [ ... ]}`, e.g. `test` in `{profiles, [{test, [{deps, [...]}]}]}`.
function profileOf(stack: OpenTerm[]): string | undefined {
  const tags = stack.flatMap((term) =>
    term.bracket === '{' && term.tag ? [term.tag] : [],
  );
  const profilesIdx = tags.indexOf('profiles');
  return profilesIdx === -1 ? undefined : tags[profilesIdx + 1];
}

// Walks the whole config once, tracking the enclosing terms, and returns the
// body of every `{deps, [ ... ]}` list together with the profile it sits in.
function extractDepsSections(content: string): DepsSection[] {
  const sections: DepsSection[] = [];
  const stack: OpenTerm[] = [];
  let inString = false;
  let escaped = false;

  for (let idx = 0; idx < content.length; idx += 1) {
    const ch = content[idx];

    if (escaped) {
      escaped = false;
    } else if (inString) {
      escaped = ch === '\\';
      inString = ch !== '"';
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      stack.push({
        bracket: '{',
        tag: tupleTagRegExp.exec(content.slice(idx + 1))?.groups?.tag,
        start: idx,
      });
    } else if (ch === '[') {
      const parent = stack.at(-1);
      const isDepsList = parent?.bracket === '{' && parent.tag === 'deps';
      stack.push({
        bracket: '[',
        tag: isDepsList ? 'deps' : undefined,
        start: idx,
      });
    } else if (ch === '}' || ch === ']') {
      const term = stack.pop();
      if (term?.bracket === '[' && term.tag === 'deps') {
        sections.push({
          content: content.slice(term.start + 1, idx),
          profile: profileOf(stack),
        });
      }
    }
  }

  return sections;
}

function splitDepEntries(depsContent: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let escaped = false;

  for (const ch of depsContent) {
    if (escaped) {
      escaped = false;
      current += ch;
    } else if (inString) {
      escaped = ch === '\\';
      inString = ch !== '"';
      current += ch;
    } else if (ch === '"') {
      inString = true;
      current += ch;
    } else if (ch === '{') {
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
    } else if (depth === 0 && (ch === '[' || ch === ']')) {
      // Ignore nested-list brackets between dep tuples
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
  logger.trace(`rebar.extractPackageFile(${packageFile})`);
  const deps = new Map<string, PackageDependency>();

  const depSections = extractDepsSections(stripComments(content));
  if (depSections.length === 0) {
    return null;
  }

  for (const section of depSections) {
    const depType = section.profile ?? 'prod';
    for (const entry of splitDepEntries(section.content)) {
      const dep = parseDep(entry);
      if (dep) {
        dep.depType = depType;
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
    for (const match of lockFileContent.matchAll(lockVersionRegExp)) {
      const { name, version } = match.groups!;
      const dep = deps.get(name);
      if (dep) {
        dep.lockedVersion = version;
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
