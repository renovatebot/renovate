import {
  CodeCommitClient,
  CreatePullRequestCommand,
  CreatePullRequestInput,
  CreatePullRequestOutput,
  DeleteCommentContentCommand,
  DeleteCommentContentInput,
  DeleteCommentContentOutput,
  DescribePullRequestEventsCommand,
  DescribePullRequestEventsInput,
  DescribePullRequestEventsOutput,
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
  MergeBranchesByFastForwardCommand,
  MergeBranchesByFastForwardInput,
  MergeBranchesByFastForwardOutput,
  MergeBranchesBySquashCommand,
  MergeBranchesBySquashInput,
  MergeBranchesBySquashOutput,
  PostCommentForPullRequestCommand,
  PostCommentForPullRequestInput,
  PostCommentForPullRequestOutput,
  PullRequestEventType,
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
import type { Credentials } from '@aws-sdk/types';
import { logger } from '../../../logger';

let codeCommitClient: CodeCommitClient;

export function buildCodeCommitClient(
  region: string,
  credentials: Credentials
): CodeCommitClient {
  if (!codeCommitClient) {
    codeCommitClient = new CodeCommitClient({
      region: region,
      credentials: credentials,
    });
  }
  return codeCommitClient;
}

export async function deleteComment(
  commentIdToRemove: string
): Promise<DeleteCommentContentOutput> {
  const input: DeleteCommentContentInput = {
    commentId: commentIdToRemove,
  };
  const cmd = new DeleteCommentContentCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getPrComments(
  repository: string,
  prId: string
): Promise<GetCommentsForPullRequestOutput> {
  const input: GetCommentsForPullRequestInput = {
    repositoryName: repository,
    pullRequestId: prId,
  };
  const cmd = new GetCommentsForPullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updateComment(
  commentId: string,
  body: string
): Promise<UpdateCommentOutput> {
  const input: UpdateCommentInput = {
    commentId: commentId,
    content: body,
  };
  const cmd = new UpdateCommentCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function createPrComment(
  prNo: string,
  repository: string | undefined,
  body: string,
  beforeCommitId: string,
  afterCommitId: string
): Promise<PostCommentForPullRequestOutput> {
  const input: PostCommentForPullRequestInput = {
    pullRequestId: prNo,
    repositoryName: repository,
    content: body,
    afterCommitId: beforeCommitId,
    beforeCommitId: afterCommitId,
  };
  const cmd = new PostCommentForPullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getPrEvents(
  prNo: string
): Promise<DescribePullRequestEventsOutput> {
  const input: DescribePullRequestEventsInput = {
    pullRequestId: prNo,
    pullRequestEventType:
      PullRequestEventType.PULL_REQUEST_SOURCE_REFERENCE_UPDATED,
  };
  const cmd = new DescribePullRequestEventsCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function fastForwardMerge(
  repositoryName: string,
  sourceReference: string,
  destinationReference: string
): Promise<MergeBranchesByFastForwardOutput> {
  const input: MergeBranchesByFastForwardInput = {
    repositoryName: repositoryName,
    sourceCommitSpecifier: sourceReference,
    destinationCommitSpecifier: destinationReference,
    targetBranch: destinationReference,
  };
  const cmd = new MergeBranchesByFastForwardCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function squashMerge(
  repositoryName: string,
  sourceReference: string,
  destinationReference: string,
  title: string | undefined
): Promise<MergeBranchesBySquashOutput> {
  const input: MergeBranchesBySquashInput = {
    repositoryName: repositoryName,
    sourceCommitSpecifier: sourceReference,
    destinationCommitSpecifier: destinationReference,
    commitMessage: title,
    targetBranch: destinationReference,
  };
  const cmd = new MergeBranchesBySquashCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updatePrStatus(
  prNo: string,
  prStatusInput: PullRequestStatusEnum.CLOSED | PullRequestStatusEnum.OPEN
): Promise<UpdatePullRequestStatusOutput> {
  const input: UpdatePullRequestStatusInput = {
    pullRequestId: prNo,
    pullRequestStatus: prStatusInput,
  };
  const cmd = new UpdatePullRequestStatusCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updatePrTitle(
  prNo: string,
  title: string
): Promise<UpdatePullRequestTitleOutput> {
  const input: UpdatePullRequestTitleInput = {
    pullRequestId: `${prNo}`,
    title: title,
  };
  const cmd = new UpdatePullRequestTitleCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updatePrDescription(
  prNo: string,
  body: string
): Promise<UpdatePullRequestDescriptionOutput> {
  const input: UpdatePullRequestDescriptionInput = {
    pullRequestId: prNo,
    description: body,
  };
  const cmd = new UpdatePullRequestDescriptionCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function createPr(
  title: string,
  description: string,
  sourceRefName: string,
  targetRefName: string,
  repository: string | undefined
): Promise<CreatePullRequestOutput> {
  const input: CreatePullRequestInput = {
    title: title,
    description: description,
    targets: [
      {
        sourceReference: sourceRefName,
        destinationReference: targetRefName,
        repositoryName: repository,
      },
    ],
  };
  const cmd = new CreatePullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getFile(
  repoName: string | undefined,
  fileName: string,
  branchOrTag: string | undefined
): Promise<GetFileOutput> {
  const input: GetFileInput = {
    repositoryName: repoName,
    filePath: fileName,
    commitSpecifier: branchOrTag,
  };
  const cmd: GetFileCommand = new GetFileCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function listPullRequests(
  repository: string
): Promise<ListPullRequestsOutput> {
  const input: ListPullRequestsInput = {
    repositoryName: repository,
  };
  const cmd = new ListPullRequestsCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getRepositoryInfo(
  repository: string
): Promise<GetRepositoryOutput> {
  const input: GetRepositoryInput = {
    repositoryName: `${repository}`,
  };
  const cmd = new GetRepositoryCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getPr(
  prId: string
): Promise<GetPullRequestOutput | undefined> {
  const input: GetPullRequestInput = {
    pullRequestId: prId,
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
