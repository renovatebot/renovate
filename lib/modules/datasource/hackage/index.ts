import { Http } from '../../../util/http';
import { logger } from '../../../logger';
import { Datasource } from '../datasource';
import type {
  //DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';

export class HackageDatasource extends Datasource {
  static readonly id = 'hackage';

  constructor() {
    super(HackageDatasource.id);
  }

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult> {
    const releases = [];
    const res = await new Http('any').getJson('https://hackage.haskell.org/package/' + config.packageName + '.json');
    const versions = Object.keys(res.body as object);
    for (let version of versions) {
      logger.info({version}, 'hackage:getReleases');
      const release: Release =
        { version
        , releaseTimestamp: null
        , isStable: true
        , changelogUrl: 'https://hackage.haskell.org/package/' + config.packageName + "-" + version + "/changelog"
        };
      releases.push(release);
    }
    return {releases};
  }
}
