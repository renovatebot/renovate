import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { parse } from '../../util/html';
import { Http } from '../../util/http';
import { isVersion, id as rubyVersioningId } from '../../versioning/ruby';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'ruby-version';
export const defaultRegistryUrls = ['https://www.ruby-lang.org/'];
export const customRegistrySupport = false;
export const defaultVersioning = rubyVersioningId;

const http = new Http(id);

export async function getReleases({
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // First check the persistent cache
  const cacheNamespace = 'datasource-ruby-version';
  const cachedResult = await packageCache.get<ReleaseResult>(
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
    const rubyVersionsUrl = `${registryUrl}en/downloads/releases/`;
    const response = await http.get(rubyVersionsUrl);
    const root = parse(response.body);
    const rows = root.querySelector('.release-list').querySelectorAll('tr');
    rows.forEach((row) => {
      const tds = row.querySelectorAll('td');
      const columns: string[] = [];
      tds.forEach((td) => columns.push(td.innerHTML));
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
    });
    await packageCache.set(cacheNamespace, 'all', res, 15);
    return res;
  } catch (err) {
    throw new ExternalHostError(err);
  }
}
