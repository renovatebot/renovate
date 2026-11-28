import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { HexRepositories } from '../../../util/hex-repository.ts';
import { coerceObject } from '../../../util/object.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';
import { hex2npm } from '../../versioning/hex/index.ts';
import { api as semverExtended } from '../../versioning/semver-extended/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';

const depSectionRegExp = regEx(/defp\s+deps.*do/g);
const quotedString = String.raw`"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'`;
const depStartRegExp = regEx(`${quotedString}|{:(?<app>\\w+)`, 'g');
const fieldTokenRegExp = regEx(`${quotedString}|[{}()[\\],]`, 'g');
const commentMatchRegExp = regEx(`(?<quoted>${quotedString})|#[^\\r\\n]*`, 'g');
const keywordName = `(?:[\\p{L}_][\\p{L}\\p{N}_]*[!?]?|${quotedString})`;
const keywordOptionRegExp = regEx(`^\\s*${keywordName}\\s*:`, 'u');
const keywordTupleRegExp = regEx(
  `^\\s*\\{\\s*:(?<name>${keywordName})\\s*,(?<value>[\\s\\S]+)\\}\\s*$`,
  'u',
);
const requirementRegExp = regEx(/^\s*"(?<requirement>[^"]+)"\s*$/);
const gitRegexp = regEx(/git:\s*"(?<value>[^"]+)"/);
const githubRegexp = regEx(/github:\s*"(?<value>[^"]+)"/);
const refRegexp = regEx(/ref:\s*"(?<value>[^"]+)"/);
const branchOrTagRegexp = regEx(/(?:branch|tag):\s*"(?<value>[^"]+)"/);
const organizationRegexp = regEx(/organization:\s*"(?<value>[^"]+)"/);
const repoOptionRegexp = regEx(/^\s*(?:repo|"repo"|'repo'):\s*/);
const repoRegexp = regEx(
  /^(?::?"(?<string>[^"]+)"|(?<default>:?(?:nil|false))|:(?<atom>[\w@]+))\s*$/,
);
const hexpmOrganizationRegexp = regEx(/^hexpm:(?<name>[a-z0-9_]+)$/);
const lockedVersionRegExp = regEx(
  /^\s+"(?<app>\w+)".*?"(?<lockedVersion>\d+\.\d+\.\d+)"/,
);
const hexRegexp = regEx(/hex:\s*(?:"(?<strValue>[^"]+)"|:(?<atomValue>\w+))/);
const onlyValueRegexp = regEx(/only:\s*(?<only>\[[^\]]*\]|:\w+)/);
const onlyEnvironmentsRegexp = regEx(/:(?<env>\w+)/gm);
const projectSectionRegExp = regEx(/def\s+project\b/);
const nextDefinitionRegExp = regEx(/\n\s*defp?\s/);
const elixirRequirementRegExp = regEx(/\belixir:\s*"(?<requirement>[^"]+)"/);

const closingTokens = new Map([
  ['{', '}'],
  ['[', ']'],
  ['(', ')'],
]);

function readFields(
  content: string,
  closingToken: string,
): { fields: string[]; length: number } | null {
  const expected = [closingToken];
  const fields: string[] = [];
  let start = 0;
  for (const { 0: token, index } of content.matchAll(fieldTokenRegExp)) {
    const closing = closingTokens.get(token);
    if (closing) {
      expected.push(closing);
    } else if (token === '}' || token === ']' || token === ')') {
      if (token !== expected.pop()) {
        return null;
      }
      if (expected.length === 0) {
        fields.push(content.slice(start, index));
        return { fields, length: index + 1 };
      }
    } else if (token === ',' && expected.length === 1) {
      fields.push(content.slice(start, index));
      start = index + 1;
    }
  }
  return null;
}

/**
 * Returns the `elixir` requirement of the `project/0` keyword list as a range, if it can be converted.
 */
function extractElixirConstraint(content: string): string | null {
  const start = projectSectionRegExp.exec(content)?.index;
  if (start === undefined) {
    return null;
  }
  const projectSection = content.slice(start);
  const end = nextDefinitionRegExp.exec(projectSection)?.index;
  const requirement = elixirRequirementRegExp.exec(projectSection.slice(0, end))
    ?.groups?.requirement;
  if (!requirement) {
    return null;
  }

  const range = semver.validRange(hex2npm(requirement));
  if (!range || !semverExtended.isValid(range)) {
    logger.debug(`Skipping unsupported elixir requirement ${requirement}`);
    return null;
  }
  return range;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`mix.extractPackageFile(${packageFile})`);
  const { data: repositories } = HexRepositories.safeParse(
    coerceObject(config?.hexRepositories),
  );
  const deps = new Map<string, PackageDependency>();
  const contentArr = content
    .replace(
      commentMatchRegExp,
      (_match, quoted: string | undefined) => quoted ?? '',
    )
    .split(newlineRegex);
  for (let lineNumber = 0; lineNumber < contentArr.length; lineNumber += 1) {
    if (contentArr[lineNumber].match(depSectionRegExp)) {
      let depBuffer = '';
      do {
        depBuffer += `${contentArr[lineNumber]}\n`;
        lineNumber += 1;
      } while (
        lineNumber < contentArr.length &&
        contentArr[lineNumber].trim() !== 'end'
      );
      let tupleEnd = 0;
      for (const depMatch of depBuffer.matchAll(depStartRegExp)) {
        const app = depMatch.groups?.app;
        if (!app || depMatch.index < tupleEnd) {
          continue;
        }
        const start = depMatch.index + depMatch[0].length;
        const tuple = readFields(depBuffer.slice(start), '}');
        if (!tuple) {
          break;
        }
        tupleEnd = start + tuple.length;
        const [appSuffix, firstField, ...remaining] = tuple.fields;
        if (appSuffix.trim()) {
          continue;
        }
        const requirement = requirementRegExp.exec(firstField ?? '')?.groups
          ?.requirement;
        let options = (requirement ? remaining : tuple.fields.slice(1))
          .map((option) => option.trim())
          .filter((option) => option.length > 0);
        if (options.length === 1 && options[0].startsWith('[')) {
          const list = readFields(options[0].slice(1), ']');
          if (list?.length !== options[0].length - 1) {
            continue;
          }
          options = list.fields.filter((option) => option.trim());
        }
        const keywordOptions = options.map((option) =>
          option.replace(keywordTupleRegExp, '$<name>:$<value>'),
        );
        const opts = keywordOptions.join(',');
        const github = githubRegexp.exec(opts)?.groups?.value;
        const git = gitRegexp.exec(opts)?.groups?.value;
        const ref = refRegexp.exec(opts)?.groups?.value;
        const branchOrTag = branchOrTagRegexp.exec(opts)?.groups?.value;
        const organization = organizationRegexp.exec(opts)?.groups?.value;
        const hexGroups = hexRegexp.exec(opts)?.groups;
        const hex = hexGroups?.strValue ?? hexGroups?.atomValue;

        const onlyValue = onlyValueRegexp.exec(opts)?.groups?.only;
        const onlyEnvironments = [];
        if (onlyValue) {
          for (const match of onlyValue.matchAll(onlyEnvironmentsRegexp)) {
            onlyEnvironments.push(match.groups!.env);
          }
        }

        const dep: PackageDependency = {
          depName: app,
          depType: 'prod',
        };

        if (git ?? github) {
          dep.currentDigest = ref;
          dep.currentValue = branchOrTag;
          dep.datasource = git ? GitTagsDatasource.id : GithubTagsDatasource.id;
          dep.packageName = git ?? github;
        } else {
          dep.currentValue = requirement;
          dep.datasource = HexDatasource.id;
          const packageName = hex ?? app;
          const repoOption = keywordOptions.find((option) =>
            repoOptionRegexp.test(option),
          );
          const repoMatch = repoOption
            ? repoRegexp.exec(repoOption.replace(repoOptionRegexp, ''))
            : null;
          const repo = repoMatch?.groups?.string ?? repoMatch?.groups?.atom;
          const hexpmOrganization = hexpmOrganizationRegexp.exec(repo ?? '')
            ?.groups?.name;
          dep.packageName = packageName;
          if (
            keywordOptions.some((option) => !keywordOptionRegExp.test(option))
          ) {
            // An opaque keyword list can choose the repository at runtime.
            dep.skipReason = 'no-repository';
          } else if (organization) {
            dep.packageName = `${packageName}:${organization}`;
          } else if (hexpmOrganization) {
            dep.packageName = `${packageName}:${hexpmOrganization}`;
          } else if (
            repoOption &&
            !repoMatch?.groups?.default &&
            repo !== 'hexpm'
          ) {
            if (repo && repositories && Object.hasOwn(repositories, repo)) {
              dep.registryUrls = [repositories[repo].url];
              dep.hexRepository = {
                ...repositories[repo],
                name: repo,
                packageName,
              };
            } else {
              dep.skipReason = 'no-repository';
            }
          }

          if (requirement?.startsWith('==')) {
            dep.currentVersion = requirement.replace(regEx(/^==\s*/), '');
          }
        }

        if (onlyValue !== undefined && !onlyEnvironments.includes('prod')) {
          dep.depType = 'dev';
        }

        deps.set(app, dep);
        logger.trace({ dep }, `setting ${app}`);
      }
    }
  }
  const lockFileName =
    (await findLocalSiblingOrParent(packageFile, 'mix.lock')) ?? 'mix.lock';
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (lockFileContent) {
    const lockFileLines = lockFileContent.split(newlineRegex).slice(1, -1);

    for (const line of lockFileLines) {
      const groups = lockedVersionRegExp.exec(line)?.groups;
      if (groups?.app && groups?.lockedVersion) {
        const dep = deps.get(groups.app);
        if (!dep) {
          continue;
        }
        dep.lockedVersion = groups.lockedVersion;
        logger.trace(`Found ${groups.lockedVersion} for ${groups.app}`);
      }
    }
  }
  const depsArray = Array.from(deps.values());
  if (depsArray.length === 0) {
    return null;
  }
  const packageFileContent: PackageFileContent = {
    deps: depsArray,
    lockFiles: lockFileContent ? [lockFileName] : undefined,
  };
  const elixirConstraint = extractElixirConstraint(contentArr.join('\n'));
  if (elixirConstraint) {
    packageFileContent.extractedConstraints = { elixir: elixirConstraint };
  }
  return packageFileContent;
}
