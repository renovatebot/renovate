import {
  GitCommit,
  GitPullRequestMergeStrategy,
  GitRef,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { logger } from '../../../logger';
import { streamToString } from '../../../util/streams';
import { getNewBranchName } from '../util';
import * as azureApi from './azure-got-wrapper';
import { WrappedExceptionSchema } from './schema';
import {
  getBranchNameWithoutRefsPrefix,
  getBranchNameWithoutRefsheadsPrefix,
} from './util';

const mergePolicyGuid = 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab'; // Magic GUID for merge strategy policy configurations

export async function getRefs(
  repoId: string,
  branchName?: string,
): Promise<GitRef[]> {
  logger.debug(`getRefs(${repoId}, ${branchName!})`);
  const azureApiGit = await azureApi.gitApi();
  const refs = await azureApiGit.getRefs(
    repoId,
    undefined,
    getBranchNameWithoutRefsPrefix(branchName),
  );
  return refs;
}

export interface AzureBranchObj {
  name: string;
  oldObjectId: string;
}

export async function getAzureBranchObj(
  repoId: string,
  branchName: string,
  from?: string,
): Promise<AzureBranchObj> {
  const fromBranchName = getNewBranchName(from);
  const refs = await getRefs(repoId, fromBranchName);
  if (refs.length === 0) {
    logger.debug(`getAzureBranchObj without a valid from, so initial commit.`);
    // TODO: fix undefined
    return {
      name: getNewBranchName(branchName)!,
      oldObjectId: '0000000000000000000000000000000000000000',
    };
  }
  return {
    // TODO: fix undefined (#22198)
    name: getNewBranchName(branchName)!,
    oldObjectId: refs[0].objectId!,
  };
}

// if no branchName, look globally
export async function getFile(
  repoId: string,
  filePath: string,
  branchName: string,
): Promise<string | null> {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const azureApiGit = await azureApi.gitApi();
  const item = await azureApiGit.getItemText(
    repoId,
    filePath,
    undefined,
    undefined,
    0, // because we look for 1 file
    false,
    false,
    true,
    {
      versionType: 0, // branch
      versionOptions: 0,
      version: getBranchNameWithoutRefsheadsPrefix(branchName),
    },
  );

  if (item?.readable) {
    const fileContent = await streamToString(item);
    try {
      const result = WrappedExceptionSchema.safeParse(fileContent);
      if (result.success) {
        if (result.data.typeKey === 'GitItemNotFoundException') {
          logger.warn(`Unable to find file ${filePath}`);
          return null;
        }
        if (result.data.typeKey === 'GitUnresolvableToCommitException') {
          logger.warn(`Unable to find branch ${branchName}`);
          return null;
        }
      }
    } catch (error) {
      // it 's not a JSON, so I send the content directly with the line under
    }

    return fileContent;
  }
  return null; // no file found
}

export async function getCommitDetails(
  commit: string,
  repoId: string,
): Promise<GitCommit> {
  logger.debug(`getCommitDetails(${commit}, ${repoId})`);
  const azureApiGit = await azureApi.gitApi();
  const results = await azureApiGit.getCommit(commit, repoId);
  return results;
}

export async function getMergeMethod(
  repoId: string,
  project: string,
  branchRef?: string | null,
  defaultBranch?: string,
): Promise<GitPullRequestMergeStrategy> {
  logger.debug(
    `getMergeMethod(branchRef=${branchRef}, defaultBranch=${defaultBranch})`,
  );
  type Scope = {
    repositoryId: string;
    refName?: string;
    matchKind: 'Prefix' | 'Exact' | 'DefaultBranch';
  };
  const isRelevantScope = (scope: Scope): boolean => {
    if (
      scope.matchKind === 'DefaultBranch' &&
      // TODO: types (#22198)
      (!branchRef || branchRef === `refs/heads/${defaultBranch!}`)
    ) {
      return true;
    }
    if (scope.repositoryId !== repoId && scope.repositoryId !== null) {
      return false;
    }
    if (!branchRef) {
      return true;
    }
    // TODO #22198
    return scope.matchKind === 'Exact'
      ? scope.refName === branchRef
      : branchRef.startsWith(scope.refName!);
  };

  const policyConfigurations = (
    await (
      await azureApi.policyApi()
    ).getPolicyConfigurations(project, undefined, mergePolicyGuid)
  )
    .filter((p) => p.settings.scope.some(isRelevantScope))
    .map((p) => p.settings)[0];

  logger.debug(
    // TODO: types (#22198)
    `getMergeMethod(branchRef=${branchRef!}) determining mergeMethod from matched policy:\n${JSON.stringify(
      policyConfigurations,
      null,
      4,
    )}`,
  );

  try {
    // TODO: fix me, wrong types
    return Object.keys(policyConfigurations)
      .map(
        (p) =>
          GitPullRequestMergeStrategy[
            p.slice(5) as never
          ] as never as GitPullRequestMergeStrategy,
      )
      .find((p) => p)!;
  } catch (err) {
    return GitPullRequestMergeStrategy.NoFastForward;
  }
}
