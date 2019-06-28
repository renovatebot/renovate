import * as azureApi from './azure-got-wrapper';

/**
 *
 * @param {string} branchName
 */
export function getNewBranchName(branchName?: string) {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}

/**
 *
 * @param {string} branchPath
 */
export function getBranchNameWithoutRefsheadsPrefix(branchPath: string) {
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

/**
 *
 * @param {string} branchPath
 */
function getBranchNameWithoutRefsPrefix(branchPath?: string) {
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

/**
 *
 * @param {string} repoId
 * @param {string} branchName
 */
export async function getRefs(repoId: string, branchName?: string) {
  logger.debug(`getRefs(${repoId}, ${branchName})`);
  const azureApiGit = await azureApi.gitApi();
  const refs = await azureApiGit.getRefs(
    repoId,
    undefined,
    getBranchNameWithoutRefsPrefix(branchName)
  );
  return refs;
}

/**
 *
 * @param {string} branchName
 * @param {string} from
 */
export async function getAzureBranchObj(
  repoId: string,
  branchName: string,
  from?: string
) {
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
/**
 *
 * @param {string} msg
 * @param {string} filePath
 * @param {string} fileContent
 * @param {string} repoId
 * @param {string} repository
 * @param {string} branchName
 */
export async function getChanges(
  files: any,
  repoId: any,
  repository: any,
  branchName: any
) {
  const changes = [];
  for (const file of files) {
    // Add or update
    let changeType = 1;
    const fileAlreadyThere = await getFile(
      repoId,
      repository,
      file.name,
      branchName
    );
    if (fileAlreadyThere) {
      changeType = 2;
    }

    changes.push({
      changeType,
      item: {
        path: file.name,
      },
      newContent: {
        Content: file.contents,
        ContentType: 0, // RawText
      },
    });
  }

  return changes;
}

/**
 * if no branchName, look globaly
 * @param {string} repoId
 * @param {string} repository
 * @param {string} filePath
 * @param {string} branchName
 */
export async function getFile(
  repoId: string,
  repository: any,
  filePath: string,
  branchName: any
) {
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

  if (item && item.readable) {
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

async function streamToString(stream: NodeJS.ReadableStream) {
  const chunks: string[] = [];
  /* eslint-disable promise/avoid-new */
  const p = await new Promise<string>(resolve => {
    stream.on('data', (chunk: any) => {
      chunks.push(chunk.toString());
    });
    stream.on('end', () => {
      resolve(chunks.join(''));
    });
  });
  return p;
}

/**
 *
 * @param {string} str
 */
export function max4000Chars(str: string) {
  if (str && str.length >= 4000) {
    return str.substring(0, 3999);
  }
  return str;
}

export function getRenovatePRFormat(azurePr: {
  pullRequestId: any;
  description: any;
  status: number;
  mergeStatus: number;
}) {
  const pr = azurePr as any;

  pr.displayNumber = `Pull Request #${azurePr.pullRequestId}`;
  pr.number = azurePr.pullRequestId;
  pr.body = azurePr.description;

  // status
  // export declare enum PullRequestStatus {
  //   NotSet = 0,
  //   Active = 1,
  //   Abandoned = 2,
  //   Completed = 3,
  //   All = 4,
  // }
  if (azurePr.status === 2) {
    pr.state = 'closed';
  } else if (azurePr.status === 3) {
    pr.state = 'merged';
  } else {
    pr.state = 'open';
  }

  // mergeStatus
  // export declare enum PullRequestAsyncStatus {
  //   NotSet = 0,
  //   Queued = 1,
  //   Conflicts = 2,
  //   Succeeded = 3,
  //   RejectedByPolicy = 4,
  //   Failure = 5,
  // }
  if (azurePr.mergeStatus === 2) {
    pr.isConflicted = true;
  }

  pr.canRebase = true;

  return pr;
}

export async function getCommitDetails(commit: string, repoId: string) {
  logger.debug(`getCommitDetails(${commit}, ${repoId})`);
  const azureApiGit = await azureApi.gitApi();
  const results = await azureApiGit.getCommit(commit, repoId);
  return results;
}

/**
 *
 * @param {string} str
 */
export function getProjectAndRepo(str: string) {
  logger.trace(`getProjectAndRepo(${str})`);
  const strSplited = str.split(`/`);
  if (strSplited.length === 1) {
    return {
      project: str,
      repo: str,
    };
  }
  if (strSplited.length === 2) {
    return {
      project: strSplited[0],
      repo: strSplited[1],
    };
  }
  const msg = `${str} can be only structured this way : 'repository' or 'projectName/repository'!`;
  logger.error(msg);
  throw new Error(msg);
}
