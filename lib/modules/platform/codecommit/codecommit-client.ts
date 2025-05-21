import type {
  CreatePullRequestApprovalRuleInput,
  CreatePullRequestApprovalRuleOutput,
  CreatePullRequestInput,
  CreatePullRequestOutput,
  DeleteCommentContentInput,
  DeleteCommentContentOutput,
  GetCommentsForPullRequestInput,
  GetCommentsForPullRequestOutput,
  GetFileInput,
  GetFileOutput,
  GetPullRequestInput,
  GetPullRequestOutput,
  GetRepositoryInput,
  GetRepositoryOutput,
  ListPullRequestsInput,
  ListPullRequestsOutput,
  ListRepositoriesInput,
  ListRepositoriesOutput,
  PostCommentForPullRequestInput,
  PostCommentForPullRequestOutput,
  UpdateCommentInput,
  UpdateCommentOutput,
  UpdatePullRequestDescriptionInput,
  UpdatePullRequestDescriptionOutput,
  UpdatePullRequestStatusInput,
  UpdatePullRequestStatusOutput,
  UpdatePullRequestTitleInput,
  UpdatePullRequestTitleOutput,
} from '@aws-sdk/client-codecommit';
import {
  CodeCommitClient,
  CreatePullRequestApprovalRuleCommand,
  CreatePullRequestCommand,
  DeleteCommentContentCommand,
  GetCommentsForPullRequestCommand,
  GetFileCommand,
  GetPullRequestCommand,
  GetRepositoryCommand,
  ListPullRequestsCommand,
  ListRepositoriesCommand,
  PostCommentForPullRequestCommand,
  PullRequestStatusEnum,
  UpdateCommentCommand,
  UpdatePullRequestDescriptionCommand,
  UpdatePullRequestStatusCommand,
  UpdatePullRequestTitleCommand,
} from '@aws-sdk/client-codecommit';
import type { RepositoryMetadata } from '@aws-sdk/client-codecommit/dist-types/models/models_0';
import is from '@sindresorhus/is';
import * as aws4 from 'aws4';
import { REPOSITORY_UNINITIATED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { getEnv } from '../../../util/env';

let codeCommitClient: CodeCommitClient;

export function buildCodeCommitClient(): void {
  if (!codeCommitClient) {
    codeCommitClient = new CodeCommitClient({});
  }

  /* v8 ignore start */
  if (!codeCommitClient) {
    throw new Error('Failed to initialize codecommit client');
  } /* v8 ignore stop */
}

export async function deleteComment(
  commentId: string,
): Promise<DeleteCommentContentOutput> {
  const input: DeleteCommentContentInput = {
    commentId,
  };
  const cmd = new DeleteCommentContentCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getPrComments(
  pullRequestId: string,
): Promise<GetCommentsForPullRequestOutput> {
  const input: GetCommentsForPullRequestInput = {
    pullRequestId,
  };
  const cmd = new GetCommentsForPullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updateComment(
  commentId: string,
  content: string,
): Promise<UpdateCommentOutput> {
  const input: UpdateCommentInput = {
    commentId,
    content,
  };
  const cmd = new UpdateCommentCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function createPrComment(
  pullRequestId: string,
  repositoryName: string | undefined,
  content: string,
  beforeCommitId: string,
  afterCommitId: string,
): Promise<PostCommentForPullRequestOutput> {
  const input: PostCommentForPullRequestInput = {
    pullRequestId,
    repositoryName,
    content,
    afterCommitId,
    beforeCommitId,
  };
  const cmd = new PostCommentForPullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

// export async function fastForwardMerge(
//   repositoryName: string,
//   sourceCommitSpecifier: string,
//   destinationReference: string
// ): Promise<MergeBranchesByFastForwardOutput> {
//   const input: MergeBranchesByFastForwardInput = {
//     repositoryName,
//     sourceCommitSpecifier,
//     destinationCommitSpecifier: destinationReference,
//     targetBranch: destinationReference,
//   };
//   const cmd = new MergeBranchesByFastForwardCommand(input);
//   return await codeCommitClient.send(cmd);
// }

// export async function squashMerge(
//   repositoryName: string,
//   sourceCommitSpecifier: string,
//   destinationReference: string,
//   commitMessage: string | undefined
// ): Promise<MergeBranchesBySquashOutput> {
//   const input: MergeBranchesBySquashInput = {
//     repositoryName,
//     sourceCommitSpecifier,
//     destinationCommitSpecifier: destinationReference,
//     targetBranch: destinationReference,
//     commitMessage,
//   };
//   const cmd = new MergeBranchesBySquashCommand(input);
//   return await codeCommitClient.send(cmd);
// }

export async function updatePrStatus(
  pullRequestId: string,
  pullRequestStatus: PullRequestStatusEnum,
): Promise<UpdatePullRequestStatusOutput> {
  const input: UpdatePullRequestStatusInput = {
    pullRequestId,
    pullRequestStatus,
  };
  const cmd = new UpdatePullRequestStatusCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updatePrTitle(
  prNo: string,
  title: string,
): Promise<UpdatePullRequestTitleOutput> {
  const input: UpdatePullRequestTitleInput = {
    pullRequestId: `${prNo}`,
    title,
  };
  const cmd = new UpdatePullRequestTitleCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updatePrDescription(
  pullRequestId: string,
  description: string,
): Promise<UpdatePullRequestDescriptionOutput> {
  const input: UpdatePullRequestDescriptionInput = {
    pullRequestId,
    description,
  };
  const cmd = new UpdatePullRequestDescriptionCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function createPr(
  title: string,
  description: string,
  sourceReference: string,
  destinationReference: string,
  repositoryName: string | undefined,
): Promise<CreatePullRequestOutput> {
  const input: CreatePullRequestInput = {
    title,
    description,
    targets: [
      {
        sourceReference,
        destinationReference,
        repositoryName,
      },
    ],
  };
  const cmd = new CreatePullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getFile(
  repositoryName: string | undefined,
  filePath: string,
  commitSpecifier: string | undefined,
): Promise<GetFileOutput> {
  const input: GetFileInput = {
    repositoryName,
    filePath,
    commitSpecifier,
  };
  const cmd: GetFileCommand = new GetFileCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function listPullRequests(
  repositoryName: string,
): Promise<ListPullRequestsOutput> {
  const input: ListPullRequestsInput = {
    repositoryName,
    pullRequestStatus: PullRequestStatusEnum.OPEN,
  };

  const cmd = new ListPullRequestsCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getRepositoryInfo(
  repository: string,
): Promise<GetRepositoryOutput> {
  const input: GetRepositoryInput = {
    repositoryName: `${repository}`,
  };
  const cmd = new GetRepositoryCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getPr(
  pullRequestId: string,
): Promise<GetPullRequestOutput | undefined> {
  const input: GetPullRequestInput = {
    pullRequestId,
  };
  const cmd = new GetPullRequestCommand(input);
  let res;
  try {
    res = await codeCommitClient.send(cmd);
  } catch (err) {
    logger.debug({ err }, 'failed to get PR using prId');
  }
  return res;
}

export async function listRepositories(): Promise<ListRepositoriesOutput> {
  const input: ListRepositoriesInput = {};
  const cmd = new ListRepositoriesCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function createPrApprovalRule(
  pullRequestId: string,
  approvalRuleContent: string,
): Promise<CreatePullRequestApprovalRuleOutput> {
  const input: CreatePullRequestApprovalRuleInput = {
    approvalRuleContent,
    approvalRuleName: 'Reviewers By Renovate',
    pullRequestId,
  };
  const cmd = new CreatePullRequestApprovalRuleCommand(input);
  return await codeCommitClient.send(cmd);
}

export function getCodeCommitUrl(
  repoMetadata: RepositoryMetadata,
  repoName: string,
): string {
  logger.debug('get code commit url');
  const env = getEnv();
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    if (repoMetadata.cloneUrlHttp) {
      return repoMetadata.cloneUrlHttp;
    }
    // shouldn't reach here, but just in case
    return `https://git-codecommit.${
      env.AWS_REGION ?? 'us-east-1'
    }.amazonaws.com/v1/repos/${repoName}`;
  }

  const signer = new aws4.RequestSigner({
    service: 'codecommit',
    host: `git-codecommit.${env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`,
    method: 'GIT',
    path: `v1/repos/${repoName}`,
  });
  const dateTime = signer.getDateTime();

  /* v8 ignore start */
  if (!is.string(dateTime)) {
    throw new Error(REPOSITORY_UNINITIATED);
  } /* v8 ignore stop */

  const token = `${dateTime}Z${signer.signature()}`;

  let username = `${env.AWS_ACCESS_KEY_ID}${
    env.AWS_SESSION_TOKEN ? `%${env.AWS_SESSION_TOKEN}` : ''
  }`;

  // massaging username with the session token,
  /* v8 ignore start */
  if (username.includes('/')) {
    username = username.replace(/\//g, '%2F');
  } /* v8 ignore stop */
  return `https://${username}:${token}@git-codecommit.${
    env.AWS_REGION ?? 'us-east-1'
  }.amazonaws.com/v1/repos/${repoName}`;
}
