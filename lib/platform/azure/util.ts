import {
  GitPullRequest,
  GitStatusContext,
  PullRequestAsyncStatus,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { logger } from '../../logger';
import { PrState } from '../../types';
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
