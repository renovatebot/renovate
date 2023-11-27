import {
  CodeCommitClient,
  CreatePullRequestApprovalRuleCommand,
  CreatePullRequestApprovalRuleInput,
  CreatePullRequestApprovalRuleOutput,
  CreatePullRequestCommand,
  CreatePullRequestInput,
  CreatePullRequestOutput,
  DeleteCommentContentCommand,
  DeleteCommentContentInput,
  DeleteCommentContentOutput,
  GetCommentsForPullRequestCommand,
  GetCommentsForPullRequestInput,
  GetCommentsForPullRequestOutput,
  GetFileCommand,
  GetFileInput,
  GetFileOutput,
  GetPullRequestCommand,
  GetPullRequestInput,
  GetPullRequestOutput,
  GetRepositoryCommand,
  GetRepositoryInput,
  GetRepositoryOutput,
  ListPullRequestsCommand,
  ListPullRequestsInput,
  ListPullRequestsOutput,
  ListRepositoriesCommand,
  ListRepositoriesInput,
  ListRepositoriesOutput,
  PostCommentForPullRequestCommand,
  PostCommentForPullRequestInput,
  PostCommentForPullRequestOutput,
  PullRequestStatusEnum,
  UpdateCommentCommand,
  UpdateCommentInput,
  UpdateCommentOutput,
  UpdatePullRequestDescriptionCommand,
  UpdatePullRequestDescriptionInput,
  UpdatePullRequestDescriptionOutput,
  UpdatePullRequestStatusCommand,
  UpdatePullRequestStatusInput,
  UpdatePullRequestStatusOutput,
  UpdatePullRequestTitleCommand,
  UpdatePullRequestTitleInput,
  UpdatePullRequestTitleOutput,
} from '@aws-sdk/client-codecommit';
import type { RepositoryMetadata } from '@aws-sdk/client-codecommit/dist-types/models/models_0';
import is from '@sindresorhus/is';
import * as aws4 from 'aws4';
import { REPOSITORY_UNINITIATED } from '../../../constants/error-messages';
import { logger } from '../../../logger';

let codeCommitClient: CodeCommitClient;

export function buildCodeCommitClient(): void {
  if (!codeCommitClient) {
    codeCommitClient = new CodeCommitClient({});
  }

  // istanbul ignore if
  if (!codeCommitClient) {
    throw new Error('Failed to initialize codecommit client');
  }
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
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    if (repoMetadata.cloneUrlHttp) {
      return repoMetadata.cloneUrlHttp;
    }
    // shouldn't reach here, but just in case
    return `https://git-codecommit.${
      process.env.AWS_REGION ?? 'us-east-1'
    }.amazonaws.com/v1/repos/${repoName}`;
  }

  const signer = new aws4.RequestSigner({
    service: 'codecommit',
    host: `git-codecommit.${
      process.env.AWS_REGION ?? 'us-east-1'
    }.amazonaws.com`,
    method: 'GIT',
    path: `v1/repos/${repoName}`,
  });
  const dateTime = signer.getDateTime();

  /* istanbul ignore if */
  if (!is.string(dateTime)) {
    throw new Error(REPOSITORY_UNINITIATED);
  }

  const token = `${dateTime}Z${signer.signature()}`;

  let username = `${process.env.AWS_ACCESS_KEY_ID}${
    process.env.AWS_SESSION_TOKEN ? `%${process.env.AWS_SESSION_TOKEN}` : ''
  }`;

  // massaging username with the session token,
  // istanbul ignore if
  if (username.includes('/')) {
    username = username.replace(/\//g, '%2F');
  }
  return `https://${username}:${token}@git-codecommit.${
    process.env.AWS_REGION ?? 'us-east-1'
  }.amazonaws.com/v1/repos/${repoName}`;
}
