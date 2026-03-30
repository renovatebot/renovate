import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import {
  extractGitDependency,
  extractGitDependencyMetadata,
  extractPreCommitAdditionalDependencies,
} from '../pre-commit/utils.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { type PrekConfig, PrekTomlSchema } from './schema.ts';

const repoSectionRegex = regEx(/^\s*\[\[\s*repos\s*\]\]\s*$/);
const repoLineRegex = regEx(
  /^\s*repo\s*=\s*(?<quote>["'])(?<repo>.+?)["']\s*$/,
);
const revLineWithFrozenCommentRegex = regEx(
  /^\s*rev\s*=\s*(?<replaceString>(?<quote>["'])(?<currentDigest>[a-f0-9]{40})["'](?<commentWhiteSpaces>\s*)#\s*frozen:\s*(?<currentValue>\S+))\s*$/,
);
const revLineRegex = regEx(
  /^\s*rev\s*=\s*(?<replaceString>(?<quote>["'])(?<currentDigest>[a-f0-9]{40})["'])\s*$/,
);

interface RegexDep {
  currentDigest: string;
  currentValue?: string;
  replaceString: string;
  autoReplaceStringTemplate?: string;
}

function getShaPinnedDepKey(repo: string, rev: string): string {
  return `${repo}\n${rev}`;
}

function setRegexDep(
  regexDeps: Map<string, RegexDep[]>,
  repo: string,
  dep: RegexDep,
): void {
  const key = getShaPinnedDepKey(repo, dep.currentDigest);
  const deps = regexDeps.get(key) ?? [];
  deps.push(dep);
  regexDeps.set(key, deps);
}

function extractWithRegex(content: string): Map<string, RegexDep[]> {
  logger.trace('prek.extractWithRegex()');
  const regexDeps = new Map<string, RegexDep[]>();
  let currentRepo: string | undefined;
  let pendingDeps: RegexDep[] = [];

  function storeDep(dep: RegexDep): void {
    if (currentRepo) {
      setRegexDep(regexDeps, currentRepo, dep);
      return;
    }

    pendingDeps.push(dep);
  }

  for (const line of content.split(newlineRegex)) {
    if (repoSectionRegex.test(line)) {
      currentRepo = undefined;
      pendingDeps = [];
      continue;
    }

    const repoMatch = repoLineRegex.exec(line);
    if (repoMatch?.groups) {
      currentRepo = repoMatch.groups.repo;
      for (const dep of pendingDeps) {
        setRegexDep(regexDeps, currentRepo, dep);
      }
      pendingDeps = [];
      continue;
    }

    const frozenMatch = revLineWithFrozenCommentRegex.exec(line);
    if (frozenMatch?.groups) {
      const {
        quote,
        currentDigest,
        currentValue,
        replaceString,
        commentWhiteSpaces,
      } = frozenMatch.groups;

      storeDep({
        currentDigest,
        currentValue,
        replaceString,
        autoReplaceStringTemplate: `${quote}{{#if newDigest}}{{newDigest}}${quote}{{#if newValue}}${commentWhiteSpaces}# frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quote}{{/unless}}`,
      });
      continue;
    }

    const revMatch = revLineRegex.exec(line);
    if (revMatch?.groups) {
      const { currentDigest, replaceString } = revMatch.groups;
      storeDep({
        currentDigest,
        replaceString,
      });
    }
  }

  return regexDeps;
}

function isLogicalRepo(repo: string): boolean {
  return repo === 'local' || repo === 'meta' || repo === 'builtin';
}

function shouldExtractAdditionalDependencies(
  repo: string | undefined,
): boolean {
  return repo !== 'meta' && repo !== 'builtin';
}

function findDependencies(
  config: PrekConfig,
  regexDeps: Map<string, RegexDep[]>,
): PackageDependency[] {
  if (!config.repos?.length) {
    logger.debug(`No repos section found, skipping file`);
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const item of config.repos) {
    const repo = item.repo?.trim();
    if (shouldExtractAdditionalDependencies(repo)) {
      for (const hook of item.hooks ?? []) {
        deps.push(...extractPreCommitAdditionalDependencies(hook));
      }
    }

    const rev = item.rev?.trim();
    if (!repo || !rev) {
      continue;
    }
    if (isLogicalRepo(repo)) {
      continue;
    }
    const depKey = getShaPinnedDepKey(repo, rev);
    const regexDep = regexDeps.get(depKey)?.shift();
    if (regexDep) {
      deps.push({
        ...extractGitDependencyMetadata(repo),
        currentDigest: regexDep.currentDigest,
        ...(regexDep.currentValue
          ? {
              currentValue: regexDep.currentValue,
              autoReplaceStringTemplate: regexDep.autoReplaceStringTemplate,
            }
          : {}),
        replaceString: regexDep.replaceString,
      });
      continue;
    }

    deps.push(extractGitDependency(rev, repo));
  }
  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const parsed = PrekTomlSchema.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { packageFile, err: parsed.error },
      'Failed to parse and validate prek TOML',
    );
    return null;
  }

  try {
    const regexDeps = extractWithRegex(content);
    const deps = findDependencies(parsed.data, regexDeps);
    if (deps.length) {
      logger.trace({ deps }, 'Found dependencies in prek config');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ packageFile, err }, 'Error scanning parsed prek config');
  }
  return null;
}
