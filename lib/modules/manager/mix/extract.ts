import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
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
import { getRepoOptions, stripComments } from './utils.ts';

const depSectionRegExp = regEx(/defp\s+deps.*do/g);
const depMatchRegExp = regEx(
  /{:(?<app>\w+)(?:\s*,\s*"(?<requirement>[^"]+)")?(?:\s*,\s*(?<opts>[^}]+))?}/gm,
);
const gitRegexp = regEx(/git:\s*"(?<value>[^"]+)"/);
const githubRegexp = regEx(/github:\s*"(?<value>[^"]+)"/);
const refRegexp = regEx(/ref:\s*"(?<value>[^"]+)"/);
const branchOrTagRegexp = regEx(/(?:branch|tag):\s*"(?<value>[^"]+)"/);
const organizationRegexp = regEx(/organization:\s*"(?<value>[^"]+)"/);
const lockedVersionRegExp = regEx(
  /^\s+"(?<app>\w+)".*?"(?<lockedVersion>\d+\.\d+\.\d+)"/,
);
const hexRegexp = regEx(/hex:\s*(?:"(?<strValue>[^"]+)"|:(?<atomValue>\w+))/);
const onlyValueRegexp = regEx(/only:\s*(?<only>\[[^\]]*\]|:\w+)/);
const onlyEnvironmentsRegexp = regEx(/:(?<env>\w+)/gm);
const projectSectionRegExp = regEx(/def\s+project\b/);
const nextDefinitionRegExp = regEx(/\n\s*defp?\s/);
const elixirRequirementRegExp = regEx(/\belixir:\s*"(?<requirement>[^"]+)"/);

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
  const deps = new Map<string, PackageDependency>();
  const contentArr = stripComments(content).split(newlineRegex);
  for (let lineNumber = 0; lineNumber < contentArr.length; lineNumber += 1) {
    if (contentArr[lineNumber].match(depSectionRegExp)) {
      let depBuffer = '';
      do {
        depBuffer += `${contentArr[lineNumber]}\n`;
        lineNumber += 1;
      } while (contentArr[lineNumber].trim() !== 'end');
      for (const depMatch of depBuffer.matchAll(depMatchRegExp)) {
        const { app, requirement, opts } = depMatch.groups!;
        const github = githubRegexp.exec(opts)?.groups?.value;
        const git = gitRegexp.exec(opts)?.groups?.value;
        const ref = refRegexp.exec(opts)?.groups?.value;
        const branchOrTag = branchOrTagRegexp.exec(opts)?.groups?.value;
        // `repo: "hexpm"` is the explicit default registry and
        // `repo: "hexpm:<org>"` is the canonical form of `organization:`.
        // Any other name refers to a third-party registry.
        // `opts` is an optional match group, so it is absent for deps
        // declared without any options.
        const [repoOption] = getRepoOptions(opts ?? '');
        const [repoName, repoOrganization] = coerceArray(
          repoOption?.split(':'),
        );
        const isHexpmRepo = repoName === 'hexpm';
        const repo = isHexpmRepo ? undefined : repoOption;
        let organization = organizationRegexp.exec(opts)?.groups?.value;
        if (isHexpmRepo) {
          organization ??= repoOrganization;
        }
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
          if (organization) {
            dep.packageName = `${app}:${organization}`;
          } else if (hex) {
            dep.packageName = hex;
          } else {
            dep.packageName = app;
          }

          if (requirement?.startsWith('==')) {
            dep.currentVersion = requirement.replace(regEx(/^==\s*/), '');
          }

          // A third-party `repo:` has no URL in `mix.exs`, so it must be mapped
          // through `registryAliases`, keyed by the repo name.
          if (repo) {
            const registryUrl = config?.registryAliases?.[repo];
            if (registryUrl) {
              dep.registryUrls = [registryUrl];
            } else {
              logger.debug(
                `No registryAliases entry for mix repo ${repo}, skipping ${app}`,
              );
              dep.skipReason = 'unknown-registry';
            }
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
