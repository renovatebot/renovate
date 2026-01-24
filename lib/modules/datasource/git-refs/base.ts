import { isTruthy } from '@sindresorhus/is';
import { simpleGit } from 'simple-git';
import { logger } from '../../../logger';
import { cached } from '../../../util/cache/package/cached';
import { getChildEnv } from '../../../util/exec/utils';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import { simpleGitConfig } from '../../../util/git/config';
import { getRemoteUrlWithToken } from '../../../util/git/url';
import { newlineRegex, regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig } from '../types';
import type { RawRefs } from './types';

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

    const refs = lsRemote
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
      .filter((ref) => ref.type !== 'pull' && !ref.value.endsWith('^{}'));

    return refs;
  }

  getRawRefs(config: GetReleasesConfig): Promise<RawRefs[] | null> {
    return cached(
      {
        namespace: `datasource-${gitId}`,
        key: config.packageName,
      },
      () => this._getRawRefs(config),
    );
  }
}
