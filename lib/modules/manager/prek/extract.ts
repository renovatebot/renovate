import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { parseComment } from '../github-actions/parse.ts';
import {
  extractGitDependency,
  extractGitDependencyMetadata,
  extractPreCommitAdditionalDependencies,
} from '../pre-commit/utils.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { type PrekConfig, PrekTomlSchema } from './schema.ts';

const repoSectionRegex = regEx(/^\s*\[\[\s*repos\s*\]\]\s*(?:#.*)?$/);
const repoLineRegex = regEx(
  /^\s*repo\s*=\s*(?<quote>["'])(?<repo>.+?)["']\s*(?:#.*)?$/,
);
const revLineRegex = regEx(
  /^\s*rev\s*=\s*(?<quote>["'])(?<currentDigest>[a-f0-9]{40})["'](?<commentWhiteSpaces>\s*)(?:#(?<comment>.*))?\s*$/,
);
const frozenCommentRegex = regEx(/^\s*frozen:\s*(?<currentValue>\S+)/);
const fullShaRegex = regEx(/^[a-f0-9]{40}$/);

interface RegexDep {
  currentDigest: string;
  currentValue?: string;
  replaceString: string;
  autoReplaceStringTemplate?: string;
}

interface ParsedShaComment {
  currentValue?: string;
  replaceComment?: string;
  autoReplaceCommentPrefix?: string;
}

function getShaPinnedDepKey(repo: string, rev: string): string {
  return `${repo}\n${rev}`;
}

function isFullSha(value: string): boolean {
  return fullShaRegex.test(value);
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

function getSemanticCommentSegment(comment: string): string {
  const trailingNoteIndex = comment.indexOf('#');
  if (trailingNoteIndex === -1) {
    return comment;
  }

  return comment.slice(0, trailingNoteIndex).trimEnd();
}

function parseShaComment(comment: string | undefined): ParsedShaComment {
  if (!comment) {
    return {};
  }

  const semanticComment = getSemanticCommentSegment(comment);
  const frozenMatch = frozenCommentRegex.exec(semanticComment);
  if (frozenMatch?.groups?.currentValue) {
    const { currentValue } = frozenMatch.groups;
    const replaceComment = frozenMatch[0];
    return {
      currentValue,
      replaceComment,
      autoReplaceCommentPrefix: replaceComment.slice(
        0,
        replaceComment.length - currentValue.length,
      ),
    };
  }

  const parsedComment = parseComment(semanticComment);
  const matchedComment = parsedComment.matchedString?.trim();
  if (
    parsedComment.pinnedVersion &&
    matchedComment &&
    matchedComment === semanticComment.trim()
  ) {
    const currentValue = parsedComment.pinnedVersion;
    const replaceComment = parsedComment.matchedString!;
    return {
      currentValue,
      replaceComment,
      autoReplaceCommentPrefix: replaceComment.slice(
        0,
        replaceComment.length - currentValue.length,
      ),
    };
  }

  return {};
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

    const revMatch = revLineRegex.exec(line);
    if (revMatch?.groups) {
      const { quote, currentDigest, comment, commentWhiteSpaces } =
        revMatch.groups;
      const parsedComment = parseShaComment(comment);
      if (!parsedComment.currentValue) {
        continue;
      }

      const quotedDigest = `${quote}${currentDigest}${quote}`;
      storeDep({
        currentDigest,
        currentValue: parsedComment.currentValue,
        autoReplaceStringTemplate: `${quote}{{#if newDigest}}{{newDigest}}${quote}{{#if newValue}}${commentWhiteSpaces}#${parsedComment.autoReplaceCommentPrefix}{{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quote}{{/unless}}`,
        replaceString: `${quotedDigest}${commentWhiteSpaces}#${parsedComment.replaceComment}`,
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

    const dep = extractGitDependency(rev, repo);
    if (isFullSha(rev)) {
      dep.skipReason ??= 'unspecified-version';
    }
    deps.push(dep);
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
