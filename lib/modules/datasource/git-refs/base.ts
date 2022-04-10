import simpleGit from 'simple-git';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { gitTimeoutConfig, simpleGitConfig } from '../../../util/git/config';
import { getRemoteUrlWithToken } from '../../../util/git/url';
import { newlineRegex, regEx } from '../../../util/regex';
import type { GetReleasesConfig } from '../types';
import type { RawRefs } from './types';

const refMatch = regEx(/(?<hash>.*?)\s+refs\/(?<type>.*?)\/(?<value>.*)/);
const headMatch = regEx(/(?<hash>.*?)\s+HEAD/);

// TODO: extract to a separate directory structure (#10532)
export class GitDatasource {
  static id = 'git';

  @cache({
    namespace: `datasource-${GitDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  static async getRawRefs(
    { packageName }: GetReleasesConfig,
    hostType: string
  ): Promise<RawRefs[] | null> {
    const gitConfig = { ...simpleGitConfig(), ...gitTimeoutConfig() };
    const git = simpleGit(gitConfig);

    // fetch remote tags
    const lsRemote = await git.listRemote([
      getRemoteUrlWithToken(packageName, hostType),
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
        logger.trace(`malformed ref: ${line}`);
        return null;
      })
      .filter(Boolean)
      .filter((ref) => ref.type !== 'pull' && !ref.value.endsWith('^{}'));

    return refs;
  }
}
