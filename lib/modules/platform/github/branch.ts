import { Http, HttpError } from '../../../util/http';
import { Result } from '../../../util/result';

function headRef(
  http: Http,
  repo: string,
  branchName: string
): Promise<boolean> {
  return Result.wrap(
    http.headJson(`/repos/${repo}/git/refs/heads/${branchName}`, {
      memCache: false,
    })
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
  http: Http,
  repo: string,
  branchName: string
): Promise<boolean> {
  const refNested = `${branchName}/`;
  const isNested = await headRef(http, repo, refNested);
  if (isNested) {
    const message = `Trying to create a branch '${branchName}' while it's the part of nested branch`;
    throw new Error(message);
  }

  return headRef(http, repo, branchName);
}
