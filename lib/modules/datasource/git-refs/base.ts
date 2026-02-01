import { isTruthy } from '@sindresorhus/is';
import { simpleGit } from 'simple-git';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { getChildEnv } from '../../../util/exec/utils.ts';
import { getGitEnvironmentVariables } from '../../../util/git/auth.ts';
import { simpleGitConfig } from '../../../util/git/config.ts';
import { getRemoteUrlWithToken } from '../../../util/git/url.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig } from '../types.ts';
import type { RawRefs } from './types.ts';

const refMatch = regEx(/(?<hash>.*?)\s+refs\/(?<type>.*?)\/(?<value>.*)/);
const headMatch = regEx(/(?<hash>.*?)\s+HEAD/);

const gitId = 'git';

// TODO: extract to a separate directory structure (#10532)
export abstract class GitDatasource extends Datasource {
  static id = gitId;

  constructor(id: string) {
    super(id);
  }

  private async _getRawRefs({
    packageName,
  }: GetReleasesConfig): Promise<RawRefs[] | null> {
    const gitSubmoduleAuthEnvironmentVariables = getGitEnvironmentVariables([
      this.id,
    ]);
    const gitEnv = getChildEnv({ env: gitSubmoduleAuthEnvironmentVariables });
    const git = simpleGit(simpleGitConfig()).env(gitEnv);

    // fetch remote tags
    const lsRemote = await git.listRemote([
      getRemoteUrlWithToken(packageName, this.id),
    ]);
    if (!lsRemote) {
      return null;
    }

    const allRefs = lsRemote
      .trim()
      .split(newlineRegex)
      .map((line) => line.trim())
      .map((line) => {
        let match = refMatch.exec(line);
        if (match?.groups) {
          return {
            type: match.groups.type,
            value: match.groups.value,
            hash: match.groups.hash,
          };
        }
        match = headMatch.exec(line);
        if (match?.groups) {
          return {
            type: '',
            value: 'HEAD',
            hash: match.groups.hash,
          };
        }
        logger.trace(`malformed ref: ${line}`);
        return null;
      })
      .filter(isTruthy)
      .filter((ref) => ref.type !== 'pull');

    // For annotated tags, git ls-remote returns two entries:
    // 1. The tag object hash: refs/tags/v1.0.0
    // 2. The dereferenced commit hash: refs/tags/v1.0.0^{}
    // We need to use the dereferenced commit hash (^{}) for annotated tags
    // to match what `git submodule status` returns (the actual commit hash).
    // This prevents false-positive updates that result in empty commits.
    const dereferencedTags = new Map<string, string>();
    for (const ref of allRefs) {
      if (ref.value.endsWith('^{}')) {
        // Store the commit hash for the base tag name (without ^{})
        dereferencedTags.set(ref.value.slice(0, -3), ref.hash);
      }
    }

    const refs = allRefs
      .filter((ref) => !ref.value.endsWith('^{}'))
      .map((ref) => {
        // For annotated tags, use the dereferenced commit hash
        const dereferencedHash = dereferencedTags.get(ref.value);
        if (dereferencedHash) {
          return { ...ref, hash: dereferencedHash };
        }
        return ref;
      });

    return refs;
  }

  getRawRefs(config: GetReleasesConfig): Promise<RawRefs[] | null> {
    return withCache(
      {
        namespace: `datasource-${gitId}`,
        key: config.packageName,
      },
      () => this._getRawRefs(config),
    );
  }
}
