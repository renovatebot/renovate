const got = require('got');
const { parse } = require('node-html-parser');
const { isVersion } = require('../../versioning/ruby');

module.exports = {
  getPkgReleases,
};

const rubyVersionsUrl = 'https://www.ruby-lang.org/en/downloads/releases/';

async function getPkgReleases() {
  // First check the persistent cache
  const cacheNamespace = 'datasource-ruby-version';
  const cachedResult = await renovateCache.get(cacheNamespace, 'all');
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const res = {
      homepage: 'https://ruby-lang.org',
      sourceUrl: 'https://github.com/ruby/ruby',
      releases: [],
    };
    const response = await got(rubyVersionsUrl);
    const root = parse(response.body);
    const rows = root.querySelector('.release-list').querySelectorAll('tr');
    for (const row of rows) {
      const columns = Array.from(
        row.querySelectorAll('td').map(td => td.innerHTML)
      );
      if (columns.length) {
        const version = columns[0].replace('Ruby ', '');
        if (isVersion(version)) {
          const releaseDate = columns[1];
          const changelogUrl = columns[2]
            .replace('<a href="', 'https://ruby-lang.org')
            .replace('">more...</a>', '');
          res.releases.push({ version, releaseDate, changelogUrl });
        }
      }
    }
    await renovateCache.set(cacheNamespace, 'all', res, 15);
    return res;
  } catch (err) {
    if (err && (err.statusCode === 404 || err.code === 'ENOTFOUND')) {
      throw new Error('registry-failure');
    }
    logger.warn({ err }, 'Ruby release lookup failure: Unknown error');
    throw new Error('registry-failure');
  }
}
