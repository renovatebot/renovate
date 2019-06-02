const yaml = require('js-yaml');
const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName, repository }) {
  if (!lookupName) {
    return null;
  }
  if (!repository) {
    return null;
  }
  const res = await got('index.yaml', { baseUrl: repository });
  if (!res || !res.body) {
    logger.warn(
      { dependency: lookupName },
      `Received invalid index.yaml from ${repository}`
    );
    return null;
  }
  const doc = yaml.safeLoad(res.body);
  if (!doc) {
    logger.warn(
      { dependency: lookupName },
      `Failed to parse index.yaml from ${repository}`
    );
    return null;
  }
  let releases = doc.entries[lookupName];
  if (!releases) {
    logger.warn(
      { dependency: lookupName },
      `Entry ${lookupName} doesn't exist in index.yaml from ${repository}`
    );
    return null;
  }
  releases = releases.map(entry => ({
    version: entry.version,
  }));
  return {
    releases,
  };
}
