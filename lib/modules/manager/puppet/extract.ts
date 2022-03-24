import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetDatasource } from '../../datasource/puppet';
import type { PackageDependency, PackageFile } from '../types';
import {
  RE_REPOSITORY_GITHUB_SSH_FORMAT,
  forgeRegexFactory,
  gitModuleRegexFactory,
  simpleModuleLineRegexFactory,
} from './constants';

interface ForgeContent {
  forgeUrl: string;
  moduleContent: string;
}

function getForgeDependency(
  line: RegExpExecArray,
  forgeUrl: string
): PackageDependency {
  const module = line[1];
  const version = line[2];

  return {
    depName: module,
    datasource: PuppetDatasource.id,
    packageName: module,
    currentValue: version,
    registryUrls: [forgeUrl],
  };
}

function getGitDependency(line: RegExpExecArray): PackageDependency {
  const map = new Map();

  const moduleName = line.groups.moduleName;

  [1, 2, 3].forEach((i) => {
    const key = line.groups[`key${i}`];
    const value = line.groups[`value${i}`];

    if (key && value) {
      map.set(key, value);
    }
  });

  const git = map.get('git');
  const tag = map.get('tag');

  if (git && tag) {
    const matchUrlSshFormat = RE_REPOSITORY_GITHUB_SSH_FORMAT.exec(git);

    let githubOwnerRepo;
    if (matchUrlSshFormat) {
      const githubOwner = matchUrlSshFormat[1];
      const githubRepo = matchUrlSshFormat[2];
      githubOwnerRepo = `${githubOwner}/${githubRepo}`;
    } else {
      githubOwnerRepo = git
        .replace(regEx(/^github:/), '')
        .replace(regEx(/^git\+/), '')
        .replace(regEx(/^https:\/\/github\.com\//), '')
        .replace(regEx(/\.git$/), '');
    }

    return {
      depName: moduleName,
      packageName: githubOwnerRepo,
      githubRepo: githubOwnerRepo,
      sourceUrl: git,
      gitRef: true,
      currentValue: tag,
      datasource: GithubTagsDatasource.id,
    };
  } else {
    return {
      depName: moduleName,
      gitRef: true,
      sourceUrl: git,
      skipReason: 'invalid-version',
    };
  }
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('puppet.extractPackageFile()');

  const deps: PackageDependency[] = [];

  const forgeContents: ForgeContent[] = [];

  const forgeRegex = forgeRegexFactory();
  let forge: RegExpExecArray;

  if (!forgeRegexFactory().test(content)) {
    forgeContents.push({
      forgeUrl: 'https://forgeapi.puppet.com',
      moduleContent: content,
    });
  }

  while ((forge = forgeRegex.exec(content)) !== null) {
    const forgeUrl = forge[1];
    const moduleContent = forge[2];

    forgeContents.push({
      forgeUrl,
      moduleContent,
    });
  }

  for (const { forgeUrl, moduleContent } of forgeContents) {
    const simpleModuleLineRegex = simpleModuleLineRegexFactory();

    let line: RegExpExecArray;
    while ((line = simpleModuleLineRegex.exec(moduleContent)) !== null) {
      deps.push(getForgeDependency(line, forgeUrl));
    }

    const gitModuleRegex = gitModuleRegexFactory();
    while ((line = gitModuleRegex.exec(content)) !== null) {
      deps.push(getGitDependency(line));
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
