import { parse } from 'node-html-parser';
import { logger } from '../../logger';

import got from '../../util/got';
import { isVersion } from '../../versioning/ruby';
import { PkgReleaseConfig, ReleaseResult } from '../common';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

const rubyVersionsUrl = 'https://www.ruby-lang.org/en/downloads/releases/';

export async function getPkgReleases(
  _config?: PkgReleaseConfig
): Promise<ReleaseResult> {
  // First check the persistent cache
  const cacheNamespace = 'datasource-ruby-version';
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    'all'
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const res: ReleaseResult = {
      homepage: 'https://www.ruby-lang.org',
      sourceUrl: 'https://github.com/ruby/ruby',
      releases: [],
    };
    const response = await got(rubyVersionsUrl);
    const root: any = parse(response.body);
    const rows = root.querySelector('.release-list').querySelectorAll('tr');
    for (const row of rows) {
      const columns: string[] = Array.from(
        row.querySelectorAll('td').map(td => td.innerHTML)
      );
      if (columns.length) {
        const version = columns[0].replace('Ruby ', '');
        if (isVersion(version)) {
          const releaseTimestamp = columns[1];
          const changelogUrl = columns[2]
            .replace('<a href="', 'https://www.ruby-lang.org')
            .replace('">more...</a>', '');
          res.releases.push({ version, releaseTimestamp, changelogUrl });
        }
      }
    }
    await renovateCache.set(cacheNamespace, 'all', res, 15);
    return res;
  } catch (err) {
    if (err && (err.statusCode === 404 || err.code === 'ENOTFOUND')) {
      throw new Error(DATASOURCE_FAILURE);
    }
    logger.warn({ err }, 'Ruby release lookup failure: Unknown error');
    throw new Error(DATASOURCE_FAILURE);
  }
}
