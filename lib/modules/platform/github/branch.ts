import is from '@sindresorhus/is';
import { z } from 'zod';
import { Http, HttpError } from '../../../util/http';
import { Result } from '../../../util/result';

export async function remoteBranchExists(
  http: Http,
  repo: string,
  branchName: string
): Promise<boolean> {
  const RefSchema = z
    .object({
      ref: z.string().transform((val) => val.replace(/^refs\/heads\//, '')),
    })
    .transform(({ ref }) => ref);

  const { val, err } = await http
    .getJsonSafe(
      `/repos/${repo}/git/refs/heads/${branchName}`,
      { memCache: false },
      z.union([RefSchema, RefSchema.array()])
    )
    .transform((x) => {
      if (is.array(x)) {
        const existingBranches = x.join(', ');
        const message = `Trying to create a branch ${branchName} while nested branches exist: ${existingBranches}`;
        const err = new Error(message);
        return Result.err(err);
      }

      return Result.ok(true); // Supposedly, `ref` always equals `branchName` at this point
    })
    .unwrap();

  if (err instanceof HttpError && err.response?.statusCode === 404) {
    return false;
  }

  if (err) {
    throw err;
  }

  return val;
}
