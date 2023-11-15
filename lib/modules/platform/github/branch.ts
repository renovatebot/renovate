import { HttpError } from '../../../util/http';
import { Result } from '../../../util/result';
import { githubApi } from './common';

function headRef(repo: string, branchName: string): Promise<boolean> {
  return Result.wrap(
    githubApi.headJson(`/repos/${repo}/git/refs/heads/${branchName}`, {
      memCache: false,
    }),
  )
    .transform(() => true)
    .catch((err) => {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return Result.ok(false);
      }

      return Result.err(err);
    })
    .unwrapOrThrow();
}

export async function remoteBranchExists(
  repo: string,
  branchName: string,
): Promise<boolean> {
  const refNested = `${branchName}/`;
  const isNested = await headRef(repo, refNested);
  if (isNested) {
    const message = `Trying to create a branch '${branchName}' while it's the part of nested branch`;
    throw new Error(message);
  }

  return headRef(repo, branchName);
}
