import {
  CodeCommitClient,
  CreatePullRequestCommand,
  CreatePullRequestInput,
  CreatePullRequestOutput,
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
  PullRequestStatusEnum,
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

export async function fastForwardMerge(
  repositoryName: string,
  sourceReference: string,
  destinationReference: string
): Promise<MergeBranchesByFastForwardOutput> {
  const squashInput: MergeBranchesByFastForwardInput = {
    repositoryName: repositoryName,
    sourceCommitSpecifier: sourceReference,
    destinationCommitSpecifier: destinationReference,
    targetBranch: destinationReference,
  };
  const squashCmd = new MergeBranchesByFastForwardCommand(squashInput);
  return await codeCommitClient.send(squashCmd);
}

export async function squashMerge(
  repositoryName: string,
  sourceReference: string,
  destinationReference: string,
  title: string | undefined
): Promise<MergeBranchesBySquashOutput> {
  const squashInput: MergeBranchesBySquashInput = {
    repositoryName: repositoryName,
    sourceCommitSpecifier: sourceReference,
    destinationCommitSpecifier: destinationReference,
    commitMessage: title,
    targetBranch: destinationReference,
  };
  const squashCmd = new MergeBranchesBySquashCommand(squashInput);
  return await codeCommitClient.send(squashCmd);
}

export async function updatePrStatus(
  prNo: string,
  prStatusInput: PullRequestStatusEnum.CLOSED | PullRequestStatusEnum.OPEN
): Promise<UpdatePullRequestStatusOutput> {
  const updateStateInput: UpdatePullRequestStatusInput = {
    pullRequestId: prNo,
    pullRequestStatus: prStatusInput,
  };
  const updateStateCmd = new UpdatePullRequestStatusCommand(updateStateInput);
  return await codeCommitClient.send(updateStateCmd);
}

export async function updatePrTitle(
  prNo: string,
  title: string
): Promise<UpdatePullRequestTitleOutput> {
  const updateTitleInput: UpdatePullRequestTitleInput = {
    pullRequestId: `${prNo}`,
    title: title,
  };
  const updateTitleCmd = new UpdatePullRequestTitleCommand(updateTitleInput);
  return await codeCommitClient.send(updateTitleCmd);
}

export async function updatePrDescription(
  prNo: string,
  body: string
): Promise<UpdatePullRequestDescriptionOutput> {
  const updateDescInput: UpdatePullRequestDescriptionInput = {
    pullRequestId: prNo,
    description: body,
  };
  const prDescCmd = new UpdatePullRequestDescriptionCommand(updateDescInput);
  return await codeCommitClient.send(prDescCmd);
}

export async function createPr(
  title: string,
  description: string,
  sourceRefName: string,
  targetRefName: string,
  repository: string | undefined
): Promise<CreatePullRequestOutput> {
  const createPrInput: CreatePullRequestInput = {
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
  const prCmd = new CreatePullRequestCommand(createPrInput);
  return await codeCommitClient.send(prCmd);
}

export async function getFile(
  repoName: string | undefined,
  fileName: string,
  branchOrTag: string | undefined
): Promise<GetFileOutput> {
  const fileInput: GetFileInput = {
    repositoryName: repoName,
    filePath: fileName,
    commitSpecifier: branchOrTag,
  };
  const fileCmd: GetFileCommand = new GetFileCommand(fileInput);
  return await codeCommitClient.send(fileCmd);
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

export async function getRepositoryInfo(
  repository: string
): Promise<GetRepositoryOutput> {
  const getRepositoryInput: GetRepositoryInput = {
    repositoryName: `${repository}`,
  };
  const getRepoCmd = new GetRepositoryCommand(getRepositoryInput);
  return await codeCommitClient.send(getRepoCmd);
}

export async function getPr(
  prId: string
): Promise<GetPullRequestOutput | undefined> {
  const prInput: GetPullRequestInput = {
    pullRequestId: prId,
  };
  const cmdPr = new GetPullRequestCommand(prInput);
  let res;
  try {
    res = await codeCommitClient.send(cmdPr);
  } catch (err) {
    logger.debug({ err }, 'failed to get PR using prId');
  }
  return res;
}

export async function listRepositories(): Promise<ListRepositoriesOutput> {
  const listRepoInput: ListRepositoriesInput = {};
  const listReposCmd = new ListRepositoriesCommand(listRepoInput);
  return await codeCommitClient.send(listReposCmd);
}
