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
  commentId: string
): Promise<DeleteCommentContentOutput> {
  const input: DeleteCommentContentInput = {
    commentId,
  };
  const cmd = new DeleteCommentContentCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function getPrComments(
  repositoryName: string,
  pullRequestId: string
): Promise<GetCommentsForPullRequestOutput> {
  const input: GetCommentsForPullRequestInput = {
    repositoryName,
    pullRequestId,
  };
  const cmd = new GetCommentsForPullRequestCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function updateComment(
  commentId: string,
  content: string
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
  afterCommitId: string
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

export async function getPrEvents(
  pullRequestId: string
): Promise<DescribePullRequestEventsOutput> {
  const input: DescribePullRequestEventsInput = {
    pullRequestId,
    pullRequestEventType:
      PullRequestEventType.PULL_REQUEST_SOURCE_REFERENCE_UPDATED,
  };
  const cmd = new DescribePullRequestEventsCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function fastForwardMerge(
  repositoryName: string,
  sourceCommitSpecifier: string,
  destinationReference: string
): Promise<MergeBranchesByFastForwardOutput> {
  const input: MergeBranchesByFastForwardInput = {
    repositoryName,
    sourceCommitSpecifier,
    destinationCommitSpecifier: destinationReference,
    targetBranch: destinationReference,
  };
  const cmd = new MergeBranchesByFastForwardCommand(input);
  return await codeCommitClient.send(cmd);
}

export async function squashMerge(
  repositoryName: string,
  sourceCommitSpecifier: string,
  destinationReference: string,
  commitMessage: string | undefined
): Promise<MergeBranchesBySquashOutput> {
  const input: MergeBranchesBySquashInput = {
    repositoryName,
    sourceCommitSpecifier,
    destinationCommitSpecifier: destinationReference,
    targetBranch: destinationReference,
    commitMessage,
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
    title,
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
  repositoryName: string | undefined,
  filePath: string,
  commitSpecifier: string | undefined
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
  repository: string,
  userArn: string
): Promise<ListPullRequestsOutput> {
  const input: ListPullRequestsInput = {
    repositoryName: repository,
    authorArn: userArn,
    pullRequestStatus: PullRequestStatusEnum.OPEN,
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

export async function createPrApprovalRule(
  pullRequestId: string,
  approvalRuleContent: string
): Promise<CreatePullRequestApprovalRuleOutput> {
  const input: CreatePullRequestApprovalRuleInput = {
    approvalRuleContent,
    approvalRuleName: 'Reviewers By Renovate',
    pullRequestId,
  };
  const cmd = new CreatePullRequestApprovalRuleCommand(input);
  return await codeCommitClient.send(cmd);
}
