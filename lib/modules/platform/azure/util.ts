import {
  GitPullRequest,
  GitRepository,
  GitStatusContext,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { logger } from '../../../logger';
import { HostRule, PrState } from '../../../types';
import type { GitOptions } from '../../../types/git';
import { addSecretForSanitizing } from '../../../util/sanitize';
import { toBase64 } from '../../../util/string';
import { getPrBodyStruct } from '../pr-body';
import type { AzurePr } from './types';

export function getGitStatusContextCombinedName(
  context: GitStatusContext | null | undefined
): string | undefined {
  if (!context) {
    return undefined;
  }
  const combinedName = `${context.genre ? `${context.genre}/` : ''}${
    // TODO: types (#7154)
    context.name!
  }`;
  logger.trace(`Got combined context name of ${combinedName}`);
  return combinedName;
}

export function getGitStatusContextFromCombinedName(
  context: string | undefined | null
): GitStatusContext | undefined {
  if (!context) {
    return undefined;
  }
  let name = context;
  let genre: string | undefined;
  const lastSlash = context.lastIndexOf('/');
  if (lastSlash > 0) {
    name = context.substring(lastSlash + 1);
    genre = context.substring(0, lastSlash);
  }
  return {
    genre,
    name,
  };
}

export function getBranchNameWithoutRefsheadsPrefix(
  branchPath: string | undefined
): string | undefined {
  if (!branchPath) {
    logger.error(`getBranchNameWithoutRefsheadsPrefix(undefined)`);
    return undefined;
  }
  if (!branchPath.startsWith('refs/heads/')) {
    logger.trace(
      `The refs/heads/ name should have started with 'refs/heads/' but it didn't. (${branchPath})`
    );
    return branchPath;
  }
  return branchPath.substring(11, branchPath.length);
}

export function getBranchNameWithoutRefsPrefix(
  branchPath?: string
): string | undefined {
  if (!branchPath) {
    logger.error(`getBranchNameWithoutRefsPrefix(undefined)`);
    return undefined;
  }
  if (!branchPath.startsWith('refs/')) {
    logger.trace(
      `The ref name should have started with 'refs/' but it didn't. (${branchPath})`
    );
    return branchPath;
  }
  return branchPath.substring(5, branchPath.length);
}

const stateMap = {
  [PullRequestStatus.Abandoned]: PrState.Closed,
  [PullRequestStatus.Completed]: PrState.Merged,
} as Record<PullRequestStatus, PrState | undefined>;

export function getRenovatePRFormat(azurePr: GitPullRequest): AzurePr {
  const number = azurePr.pullRequestId;
  // TODO: types (#7154)
  const displayNumber = `Pull Request #${number!}`;

  const sourceBranch = getBranchNameWithoutRefsheadsPrefix(
    azurePr.sourceRefName
  );
  const targetBranch = getBranchNameWithoutRefsheadsPrefix(
    azurePr.targetRefName
  );
  const bodyStruct = getPrBodyStruct(azurePr.description);

  const createdAt = azurePr.creationDate?.toISOString();

  // TODO #7154
  const state = stateMap[azurePr.status!] ?? PrState.Open;

  const sourceRefName = azurePr.sourceRefName;

  return {
    ...azurePr,
    sourceBranch,
    state,
    number,
    displayNumber,
    bodyStruct,
    sourceRefName,
    targetBranch,
    createdAt,
  } as AzurePr;
}

export function getStorageExtraCloneOpts(config: HostRule): GitOptions {
  let authType: string;
  let authValue: string;
  if (!config.token && config.username && config.password) {
    authType = 'basic';
    authValue = toBase64(`${config.username}:${config.password}`);
  } else if (config.token?.length === 52) {
    authType = 'basic';
    authValue = toBase64(`:${config.token}`);
  } else {
    authType = 'bearer';
    authValue = config.token!;
  }
  addSecretForSanitizing(authValue, 'global');
  return {
    '-c': `http.extraheader=AUTHORIZATION: ${authType} ${authValue}`,
  };
}

export function max4000Chars(str: string): string {
  if (str && str.length >= 4000) {
    return str.substring(0, 3999);
  }
  return str;
}

export function getProjectAndRepo(str: string): {
  project: string;
  repo: string;
} {
  logger.trace(`getProjectAndRepo(${str})`);
  const strSplit = str.split(`/`);
  if (strSplit.length === 1) {
    return {
      project: str,
      repo: str,
    };
  }
  if (strSplit.length === 2) {
    return {
      project: strSplit[0],
      repo: strSplit[1],
    };
  }
  const msg = `${str} can be only structured this way : 'repository' or 'projectName/repository'!`;
  logger.error(msg);
  throw new Error(msg);
}

export function getRepoByName(
  name: string,
  repos: (GitRepository | null | undefined)[] | undefined | null
): GitRepository | null {
  logger.trace(`getRepoByName(${name})`);

  let { project, repo } = getProjectAndRepo(name);
  project = project.toLowerCase();
  repo = repo.toLowerCase();

  const foundRepo = repos?.find(
    (r) =>
      project === r?.project?.name?.toLowerCase() &&
      repo === r?.name?.toLowerCase()
  );
  if (!foundRepo) {
    logger.debug(`Repo not found: ${name}`);
  }
  return foundRepo ?? null;
}
