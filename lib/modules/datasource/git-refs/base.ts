import is from '@sindresorhus/is';
import { simpleGit } from 'simple-git';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import { simpleGitConfig } from '../../../util/git/config';
import { getRemoteUrlWithToken } from '../../../util/git/url';
import { newlineRegex, regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig } from '../types';
import type { RawRefs } from './types';

const refMatch = regEx(/(?<hash>.*?)\s+refs\/(?<type>.*?)\/(?<value>.*)/);
const headMatch = regEx(/(?<hash>.*?)\s+HEAD/);

// TODO: extract to a separate directory structure (#10532)
export abstract class GitDatasource extends Datasource {
  static id = 'git';

  constructor(id: string) {
    super(id);
  }

  @cache({
    namespace: `datasource-${GitDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getRawRefs({
    packageName,
  }: GetReleasesConfig): Promise<RawRefs[] | null> {
    const gitSubmoduleAuthEnvironmentVariables = getGitEnvironmentVariables([
      this.id,
    ]);
    const gitEnv = {
      // pass all existing env variables
      ...process.env,
      // add all known git Variables
      ...gitSubmoduleAuthEnvironmentVariables,
    };
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
      .filter(is.truthy)
      .filter((ref) => ref.type !== 'pull' && !ref.value.endsWith('^{}'));

    return refs;
  }
}
