import {
  GitPullRequest,
  GitRepository,
  GitStatusContext,
  PullRequestAsyncStatus,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { logger } from '../../logger';
import { HostRule, PrState } from '../../types';
import { GitOptions } from '../../types/git';
import { add } from '../../util/sanitize';
import { AzurePr } from './types';

export function getNewBranchName(branchName?: string): string {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}

export function getGitStatusContextCombinedName(
  context: GitStatusContext
): string | undefined {
  if (!context) {
    return undefined;
  }
  const combinedName = `${context.genre ? `${context.genre}/` : ''}${
    context.name
  }`;
  logger.trace(`Got combined context name of ${combinedName}`);
  return combinedName;
}

export function getGitStatusContextFromCombinedName(
  context: string
): GitStatusContext | undefined {
  if (!context) {
    return undefined;
  }
  let name = context;
  let genre;
  const lastSlash = context.lastIndexOf('/');
  if (lastSlash > 0) {
    name = context.substr(lastSlash + 1);
    genre = context.substr(0, lastSlash);
  }
  return {
    genre,
    name,
  };
}

export function getBranchNameWithoutRefsheadsPrefix(
  branchPath: string
): string | undefined {
  if (!branchPath) {
    logger.error(`getBranchNameWithoutRefsheadsPrefix(${branchPath})`);
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
    logger.error(`getBranchNameWithoutRefsPrefix(${branchPath})`);
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

export function getRenovatePRFormat(azurePr: GitPullRequest): AzurePr {
  const number = azurePr.pullRequestId;
  const displayNumber = `Pull Request #${number}`;

  const sourceBranch = getBranchNameWithoutRefsheadsPrefix(
    azurePr.sourceRefName
  );
  const targetBranch = getBranchNameWithoutRefsheadsPrefix(
    azurePr.targetRefName
  );
  const body = azurePr.description;

  const createdAt = azurePr.creationDate?.toISOString();
  const state =
    {
      [PullRequestStatus.Abandoned]: PrState.Closed,
      [PullRequestStatus.Completed]: PrState.Merged,
    }[azurePr.status] || PrState.Open;

  const sourceRefName = azurePr.sourceRefName;

  const isConflicted = azurePr.mergeStatus === PullRequestAsyncStatus.Conflicts;

  return {
    ...azurePr,
    sourceBranch,
    state,
    number,
    displayNumber,
    body,
    sourceRefName,
    targetBranch,
    createdAt,
    ...(isConflicted && { isConflicted }),
  } as AzurePr;
}

export async function streamToString(
  stream: NodeJS.ReadableStream
): Promise<string> {
  const chunks: Uint8Array[] = [];
  /* eslint-disable promise/avoid-new */
  const p = await new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', (err) => reject(err));
  });
  return p;
}

function toBase64(from: string): string {
  return Buffer.from(from).toString('base64');
}

export function getStorageExtraCloneOpts(config: HostRule): GitOptions {
  let authType: string;
  let authValue: string;
  if (!config.token && config.username && config.password) {
    authType = 'basic';
    authValue = toBase64(`${config.username}:${config.password}`);
  } else if (config.token.length === 52) {
    authType = 'basic';
    authValue = toBase64(`:${config.token}`);
  } else {
    authType = 'bearer';
    authValue = config.token;
  }
  add(authValue);
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

export function getProjectAndRepo(
  str: string
): { project: string; repo: string } {
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
  repos: GitRepository[]
): GitRepository | null {
  logger.trace(`getRepoByName(${name})`);

  let { project, repo } = getProjectAndRepo(name);
  project = project.toLowerCase();
  repo = repo.toLowerCase();

  return (
    repos?.find(
      (r) =>
        project === r?.project?.name?.toLowerCase() &&
        repo === r?.name?.toLowerCase()
    ) || null
  );
}
