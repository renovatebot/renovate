import simpleGit from 'simple-git';
import { cache } from '../../util/cache/package/decorator';
import { getRemoteUrlWithToken } from '../../util/git/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig } from '../types';
import type { RawRefs } from './types';

// TODO: extract to a separate directory structure (#10532)
export abstract class GitDatasource extends Datasource {
  static id = 'git';

  @cache({
    namespace: `datasource-${GitDatasource.id}`,
    key: ({ lookupName }: GetReleasesConfig) => lookupName,
  })
  static async getRawRefs(
    { lookupName }: GetReleasesConfig,
    hostType: string
  ): Promise<RawRefs[] | null> {
    const git = simpleGit();

    // fetch remote tags
    const lsRemote = await git.listRemote([
      getRemoteUrlWithToken(lookupName, hostType),
    ]);
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

    return refs;
  }
}
