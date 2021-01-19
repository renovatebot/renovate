import crypto from 'crypto';
import fs from 'fs';
import simpleGit from 'simple-git';
import * as packageCache from '../../util/cache/package';
import { GetReleasesConfig, Release, ReleaseResult } from '../common';

export const id = 'git-subdir-commits';

const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export async function getCommits(
  { lookupName }: GetReleasesConfig,
  subdir: string
): Promise<Release[] | null> {
  let commits = [];

  const cacheNamespace = 'git-subdir-commits';
  const cachedResult = await packageCache.get<Release[]>(
    cacheNamespace,
    lookupName + subdir
  );
  /* istanbul ignore next line */
  if (cachedResult) {
    return cachedResult;
  }

  const tempDir = '/tmp/' + crypto.randomBytes(20).toString('hex');
  fs.mkdirSync(tempDir);

  try {
    const git = simpleGit(tempDir);
    await git.clone('git@github.com:' + lookupName, tempDir);
    commits = (await git.log({ file: subdir })).all.map((commit) => ({
      version: commit.hash,
      gitRef: commit.hash,
      newDigest: commit.hash,
      releaseTimestamp: commit.date,
      changelogUrl: `https://github.com/${lookupName}/commit/${commit.hash}`,
    }));
  } finally {
    fs.rmdirSync(tempDir, { recursive: true });
  }

  await packageCache.set(
    cacheNamespace,
    lookupName + subdir,
    commits,
    cacheMinutes
  );

  return commits;
}

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const [repo, subdir] = lookupName.split('//');
  const commits: Release[] = await getCommits(
    { lookupName: repo.replace('.git', '') },
    subdir
  );

  const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');

  const result: ReleaseResult = {
    sourceUrl,
    latestVersion: commits[0].version,
    releases: commits.slice(0, 1),
    versions: commits.slice(0, 1),
  };

  return result;
}
