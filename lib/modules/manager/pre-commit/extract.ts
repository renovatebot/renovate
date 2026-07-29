import { isPlainObject } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import {
  matchesPrecommitConfigHeuristic,
  matchesPrecommitDependencyHeuristic,
} from './parsing.ts';
import type { PreCommitConfig } from './types.ts';
import {
  extractGitDependency,
  extractPreCommitAdditionalDependencies,
} from './utils.ts';

// Matches: rev: <digest><whitespace># frozen: <version>
const revLineWithFrozenCommentRegex = regEx(
  /^\s*rev:\s*(?<replaceString>(?<currentDigest>[a-f0-9]{40})(?<commentWhiteSpaces>\s+)#\s*frozen:\s*(?<currentValue>\S+))/,
);

interface RegexDep {
  currentDigest: string;
  currentValue: string;
  replaceString: string;
  autoReplaceStringTemplate: string;
}

function extractWithRegex(content: string): Map<string, RegexDep> {
  logger.trace('pre-commit.extractWithRegex()');
  const regexDeps = new Map<string, RegexDep>();

  for (const line of content.split(newlineRegex)) {
    if (line.trim().startsWith('#')) {
      continue;
    }

    const match = revLineWithFrozenCommentRegex.exec(line);
    if (match?.groups) {
      const { currentDigest, currentValue, replaceString, commentWhiteSpaces } =
        match.groups;

      // Store by digest to correlate with YAML-extracted deps later
      regexDeps.set(currentDigest, {
        currentDigest,
        currentValue,
        replaceString,
        autoReplaceStringTemplate: `{{newDigest}}${commentWhiteSpaces}# frozen: {{newValue}}`,
      });
    }
  }

  return regexDeps;
}

/**
 * Find all supported dependencies in the pre-commit yaml object.
 *
 * @param precommitFile the parsed yaml config file
 * @param regexDeps Map of regex-extracted deps keyed by digest for enrichment
 */
function findDependencies(
  precommitFile: PreCommitConfig,
  regexDeps: Map<string, RegexDep>,
): PackageDependency[] {
  if (!precommitFile.repos) {
    logger.debug(`No repos section found, skipping file`);
    return [];
  }
  const packageDependencies: PackageDependency[] = [];

  for (const item of precommitFile.repos) {
    // meta hooks is defined from pre-commit and doesn't support `additional_dependencies`
    if (item.repo !== 'meta') {
      for (const hook of item.hooks ?? []) {
        // normally language are not defined in yaml
        // only support it when it's explicitly defined.
        // this avoid to parse hooks from pre-commit-hooks.yaml from git repo
        packageDependencies.push(
          ...extractPreCommitAdditionalDependencies(hook),
        );
      }
    }

    if (matchesPrecommitDependencyHeuristic(item)) {
      logger.trace(item, 'Matched pre-commit dependency spec');
      const repository = String(item.repo);
      const tag = String(item.rev);
      const dep = extractGitDependency(tag, repository);

      // Check if this rev has regex-extracted formatting info
      const regexDep = regexDeps.get(tag);
      if (regexDep) {
        // Enrich with formatting info from regex extraction
        dep.currentDigest = regexDep.currentDigest;
        dep.currentValue = regexDep.currentValue;
        dep.replaceString = regexDep.replaceString;
        dep.autoReplaceStringTemplate = regexDep.autoReplaceStringTemplate;
      }

      packageDependencies.push(dep);
    } else {
      logger.trace(item, 'Did not find pre-commit repo spec');
    }
  }
  return packageDependencies;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  type ParsedContent = Record<string, unknown> | PreCommitConfig;
  let parsedContent: ParsedContent;
  try {
    // TODO: use schema (#9610)
    parsedContent = parseSingleYaml(content);
  } catch (err) {
    logger.debug(
      { filename: packageFile, err },
      'Failed to parse pre-commit config YAML',
    );
    return null;
  }
  if (!isPlainObject<Record<string, unknown>>(parsedContent)) {
    logger.debug(
      { packageFile },
      `Parsing of pre-commit config YAML returned invalid result`,
    );
    return null;
  }
  if (!matchesPrecommitConfigHeuristic(parsedContent)) {
    logger.debug(
      { packageFile },
      `File does not look like a pre-commit config file`,
    );
    return null;
  }
  try {
    const regexDeps = extractWithRegex(content);
    const deps = findDependencies(parsedContent, regexDeps);
    if (deps.length) {
      logger.trace({ deps }, 'Found dependencies in pre-commit config');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { packageFile, err },
      'Error scanning parsed pre-commit config',
    );
  }
  return null;
}
