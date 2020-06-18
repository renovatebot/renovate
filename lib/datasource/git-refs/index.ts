import simpleGit from 'simple-git/promise';
import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import * as semver from '../../versioning/semver';
import { DigestConfig, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'git-refs';

const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export interface RawRefs {
  type: string;
  value: string;
  hash: string;
}

export async function getRawRefs({
  lookupName,
}: GetReleasesConfig): Promise<RawRefs[] | null> {
  const git = simpleGit();
  try {
    const cacheNamespace = 'git-raw-refs';

    const cachedResult = await globalCache.get<RawRefs[]>(
      cacheNamespace,
      lookupName
    );
    /* istanbul ignore next line */
    if (cachedResult) {
      return cachedResult;
    }

    // fetch remote tags
    const lsRemote = await git.listRemote([lookupName]);
    if (!lsRemote) {
      return null;
    }

    const refMatch = /(?<hash>.*?)\s+refs\/(?<type>.*?)\/(?<value>.*)/;
    const headMatch = /(?<hash>.*?)\s+HEAD/;

    const refs = lsRemote
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .map((line) => {
        let match = refMatch.exec(line);
        if (match) {
          return {
            type: match.groups.type,
            value: match.groups.value,
            hash: match.groups.hash,
          };
        }
        match = headMatch.exec(line);
        if (match) {
          return {
            type: '',
            value: 'HEAD',
            hash: match.groups.hash,
          };
        }
        // istanbul ignore next
        return null;
      })
      .filter(Boolean)
      .filter((ref) => ref.type !== 'pull' && !ref.value.endsWith('^{}'));
    await globalCache.set(cacheNamespace, lookupName, refs, cacheMinutes);
    return refs;
  } catch (err) {
    logger.info({ err }, `Git-Raw-Refs lookup error in ${lookupName}`);
  }
  return null;
}

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  try {
    const rawRefs: RawRefs[] = await getRawRefs({ lookupName });

    const refs = rawRefs
      .filter((ref) => ref.type === 'tags' || ref.type === 'heads')
      .map((ref) => ref.value)
      .filter((ref) => semver.isVersion(ref));

    const uniqueRefs = [...new Set(refs)];

    const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');

    const result: ReleaseResult = {
      sourceUrl,
      releases: uniqueRefs.map((ref) => ({
        version: ref,
        gitRef: ref,
        newDigest: rawRefs.find((rawRef) => rawRef.value === ref).hash,
      })),
    };

    return result;
  } catch (err) {
    logger.error({ err }, `Git-Refs lookup error in ${lookupName}`);
  }
  return null;
}

export async function getDigest(
  { lookupName }: Partial<DigestConfig>,
  newValue?: string
): Promise<string | null> {
  const rawRefs: RawRefs[] = await getRawRefs({ lookupName });
  const findValue = newValue || 'HEAD';
  const ref = rawRefs.find((rawRef) => rawRef.value === findValue);
  if (ref) {
    return ref.hash;
  }
  return null;
}
