import {
  GitCommit,
  GitPullRequestMergeStrategy,
  GitRef,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { logger } from '../../logger';
import { HostRule } from '../../types';
import { GitOptions } from '../../types/git';
import { add } from '../../util/sanitize';
import * as azureApi from './azure-got-wrapper';
import {
  getBranchNameWithoutRefsPrefix,
  getBranchNameWithoutRefsheadsPrefix,
  getNewBranchName,
} from './util';

const mergePolicyGuid = 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab'; // Magic GUID for merge strategy policy configurations

function toBase64(from: string): string {
  return Buffer.from(from).toString('base64');
}

export function getStorageExtraCloneOpts(config: HostRule): GitOptions {
  let authType: string;
  let authValue: string;
  if (!config.token && config.username && config.password) {
    authType = 'basic';
    authValue = toBase64(`${config.username}:${config.password}`);
  } else if (config.token.length !== 52) {
    authType = 'bearer';
    authValue = config.token;
  } else {
    authType = 'basic';
    authValue = toBase64(`:${config.token}`);
  }
  add(authValue);
  return {
    '-c': `http.extraheader=AUTHORIZATION: ${authType} ${authValue}`,
  };
}

export async function getRefs(
  repoId: string,
  branchName?: string
): Promise<GitRef[]> {
  logger.debug(`getRefs(${repoId}, ${branchName})`);
  const azureApiGit = await azureApi.gitApi();
  const refs = await azureApiGit.getRefs(
    repoId,
    undefined,
    getBranchNameWithoutRefsPrefix(branchName)
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
  from?: string
): Promise<AzureBranchObj> {
  const fromBranchName = getNewBranchName(from);
  const refs = await getRefs(repoId, fromBranchName);
  if (refs.length === 0) {
    logger.debug(`getAzureBranchObj without a valid from, so initial commit.`);
    return {
      name: getNewBranchName(branchName),
      oldObjectId: '0000000000000000000000000000000000000000',
    };
  }
  return {
    name: getNewBranchName(branchName),
    oldObjectId: refs[0].objectId,
  };
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: string[] = [];
  /* eslint-disable promise/avoid-new */
  const p = await new Promise<string>((resolve) => {
    stream.on('data', (chunk: any) => {
      chunks.push(chunk.toString());
    });
    stream.on('end', () => {
      resolve(chunks.join(''));
    });
  });
  return p;
}

// if no branchName, look globally
export async function getFile(
  repoId: string,
  filePath: string,
  branchName: string
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
    }
  );

  if (item?.readable) {
    const fileContent = await streamToString(item);
    try {
      const jTmp = JSON.parse(fileContent);
      if (jTmp.typeKey === 'GitItemNotFoundException') {
        // file not found
        return null;
      }
      if (jTmp.typeKey === 'GitUnresolvableToCommitException') {
        // branch not found
        return null;
      }
    } catch (error) {
      // it 's not a JSON, so I send the content directly with the line under
    }
    return fileContent;
  }
  return null; // no file found
}

export function max4000Chars(str: string): string {
  if (str && str.length >= 4000) {
    return str.substring(0, 3999);
  }
  return str;
}

export async function getCommitDetails(
  commit: string,
  repoId: string
): Promise<GitCommit> {
  logger.debug(`getCommitDetails(${commit}, ${repoId})`);
  const azureApiGit = await azureApi.gitApi();
  const results = await azureApiGit.getCommit(commit, repoId);
  return results;
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

export async function getMergeMethod(
  repoId: string,
  project: string
): Promise<GitPullRequestMergeStrategy> {
  const policyConfigurations = (
    await (await azureApi.policyApi()).getPolicyConfigurations(project)
  )
    .filter(
      (p) =>
        p.settings.scope.some((s) => s.repositoryId === repoId) &&
        p.type.id === mergePolicyGuid
    )
    .map((p) => p.settings)[0];

  try {
    return Object.keys(policyConfigurations)
      .map((p) => GitPullRequestMergeStrategy[p.slice(5)])
      .find((p) => p);
  } catch (err) {
    return GitPullRequestMergeStrategy.NoFastForward;
  }
}
