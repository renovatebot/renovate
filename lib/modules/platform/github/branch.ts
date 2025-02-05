import { z } from 'zod';
import { regEx } from '../../../util/regex';
import { githubApi } from './common';

const MatchingRef = z
  .object({ ref: z.string() })
  .transform(({ ref }) => ref.replace(regEx(/^refs\/heads\//), ''))
  .array();

async function matchingBranches(
  repo: string,
  branchName: string,
): Promise<string[]> {
  const { body: branches } = await githubApi.getJson(
    `/repos/${repo}/git/matching-refs/heads/${branchName}`,
    { memCache: false },
    MatchingRef,
  );
  return branches;
}

export async function remoteBranchExists(
  repo: string,
  branchName: string,
): Promise<boolean> {
  const branches = await matchingBranches(repo, branchName);
  if (branches.some((branch) => branch.startsWith(`${branchName}/`))) {
    const message = `Trying to create a branch '${branchName}' while it's the part of nested branch`;
    throw new Error(message);
  }

  return branches.includes(branchName);
}
